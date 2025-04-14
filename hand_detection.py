import cv2
import mediapipe as mp

# IMPORTANT! Hand gesture controls are determined by the left hand! (is_open_palm, is_yolo, is_peace)
class HandDetector:
    def __init__(self, mode=False, maxHands=2, detectionCon=0.5, trackCon=0.5):
        self.mode = mode
        self.maxHands = maxHands
        self.detectionCon = detectionCon
        self.trackCon = trackCon

        self.mpHands = mp.solutions.hands
        self.hands = self.mpHands.Hands(
            static_image_mode=self.mode,
            max_num_hands=self.maxHands,
            min_detection_confidence=self.detectionCon,
            min_tracking_confidence=self.trackCon
        )
        self.mpDraw = mp.solutions.drawing_utils

    def findHands(self, img, draw=True):
        # Convert the BGR image to RGB
        imgRGB = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        self.results = self.hands.process(imgRGB)

        # Draw hand landmarks if available
        if self.results.multi_hand_landmarks:
            for handLms in self.results.multi_hand_landmarks:
                if draw:
                    self.mpDraw.draw_landmarks(img, handLms, self.mpHands.HAND_CONNECTIONS)
        return img

    def findPosition(self, img, handNo=0, draw=False):
        lmList = []
        if self.results.multi_hand_landmarks:
            myHand = self.results.multi_hand_landmarks[handNo]
            h, w, c = img.shape
            for id, lm in enumerate(myHand.landmark):
                cx, cy = int(lm.x * w), int(lm.y * h)
                lmList.append([id, cx, cy])
                if draw:
                    cv2.circle(img, (cx, cy), 5, (255, 0, 255), cv2.FILLED)
        return lmList

    def is_left_hand(self, lmList):
        """Check if the hand is a left hand."""
        if not lmList:
            return False
        return lmList[0][0] == 'Left'

    def is_right_hand(self, lmList):
        """Check if the hand is a right hand."""
        if not lmList:
            return False
        return lmList[0][0] == 'Right'

    def get_hand_landmarks(self, lmList, hand_type):
        """Get the landmarks for a specific hand type."""
        if not lmList:
            return None
        
        for hand in lmList:
            if hand[0] == hand_type:
                return hand[1]
        return None

def is_open_palm(lmList):
    """
    For the left hand: Returns True if all five fingers are extended.
    
    Assumptions for left-hand:
      - Thumb is extended if its tip (landmark 4) lies to the RIGHT of landmark 3.
      - For index, middle, ring, and pinky: the tip's y-coordinate should be less (higher on image) than the y-coordinate
        of the joint two indices before (e.g. landmark 8 < landmark 6).
    """
    if not lmList or len(lmList) < 21:
        return False

    fingers = []
    
    # Left-hand thumb: extended if tip is to the RIGHT of landmark 3.
    if lmList[4][1] > lmList[3][1]:
        fingers.append(1)
    else:
        fingers.append(0)

    # Index finger: tip (8) above joint (6) means extended.
    if lmList[8][2] < lmList[6][2]:
        fingers.append(1)
    else:
        fingers.append(0)

    # Middle finger: tip (12) above joint (10).
    if lmList[12][2] < lmList[10][2]:
        fingers.append(1)
    else:
        fingers.append(0)

    # Ring finger: tip (16) above joint (14).
    if lmList[16][2] < lmList[14][2]:
        fingers.append(1)
    else:
        fingers.append(0)

    # Pinky finger: tip (20) above joint (18).
    if lmList[20][2] < lmList[18][2]:
        fingers.append(1)
    else:
        fingers.append(0)

    # All five fingers must be extended.
    return sum(fingers) == 5

def is_yolo(lmList):
    """
    For the left hand: Returns True for the YOLO gesture defined as:
      - Pointer finger (landmark 8) extended: tip's y < landmark 6's y.
      - Pinky finger (landmark 20) extended: tip's y < landmark 18's y.
      - Thumb extended: for the left hand, tip (landmark 4) is to the RIGHT of landmark 3.
      - Middle finger not extended: tip (landmark 12) is NOT above landmark 10.
      - Ring finger not extended: tip (landmark 16) is NOT above landmark 14.
    """
    if not lmList or len(lmList) < 21:
        return False

    # Thumb extended for left hand: tip (4) is to the right of landmark 3.
    thumb_extended = lmList[4][1] > lmList[3][1]
    
    # Pointer (index) finger extended: tip (8) is above landmark (6).
    pointer_extended = lmList[8][2] < lmList[6][2]
    
    # Pinky finger extended: tip (20) is above landmark (18).
    pinky_extended = lmList[20][2] < lmList[18][2]
    
    # Middle finger NOT extended: tip (12) is NOT above landmark (10).
    middle_not_extended = lmList[12][2] >= lmList[10][2]
    
    # Ring finger NOT extended: tip (16) is NOT above landmark (14).
    ring_not_extended = lmList[16][2] >= lmList[14][2]
    
    return thumb_extended and pointer_extended and pinky_extended and middle_not_extended and ring_not_extended
    
def is_pointer(lmList):
    """
    For the left hand: Returns True if the following conditions are met:
      - Index Finger is extended (pointing up)
      - Middle finger is folded
      - Ring finger is folded
      - Pinky finger is folded
      - Thumb is folded
    (This is our "pointing" gesture: only the index finger is up.)
    """
    if not lmList or len(lmList) < 21:
        return False

    # For an upward (extended) finger, the tip's y (lmList[][2]) should be less than the joint's y.
    index_extended = lmList[8][2] < lmList[6][2]
    
    # Middle finger extended (if it were extended) would be:
    middle_extended = lmList[12][2] < lmList[10][2]
    
    # For folded fingers, we want the tip to be lower (greater y) than the joint.
    ring_folded = lmList[16][2] > lmList[14][2]
    pinky_folded = lmList[20][2] > lmList[18][2]
    
    # For the left hand, an extended thumb would have its tip to the right (greater x)
    # than landmark 3. Since we want it folded, we want the opposite.
    thumb_extended = lmList[4][1] > lmList[3][1]
    
    return index_extended and (not middle_extended) and (not thumb_extended) and ring_folded and pinky_folded

def is_two_fingers(lmList):
    """
    For the left hand: Returns True if the following conditions are met:
      - Index and middle fingers are extended.
      - Ring finger and pinky are folded.
      - Thumb is folded.
    
    This means that only the index and middle fingers are extended.
    """
    if not lmList or len(lmList) < 21:
        return False

    # Index finger: extended if tip (8) is above joint (6).
    index_extended = lmList[8][2] < lmList[6][2]
    # Middle finger: extended if tip (12) is above joint (10).
    middle_extended = lmList[12][2] < lmList[10][2]
    # Ring finger: folded if tip (16) is lower than joint (14).
    ring_folded = lmList[16][2] > lmList[14][2]
    # Pinky finger: folded if tip (20) is lower than joint (18).
    pinky_folded = lmList[20][2] > lmList[18][2]
    # Thumb: for left hand, folded means tip is NOT to the right (i.e. less than) landmark 3.
    thumb_folded = lmList[4][1] < lmList[3][1]

    return index_extended and middle_extended and ring_folded and pinky_folded and thumb_folded

def is_three_fingers(lmList):
    """
    For the left hand: Returns True if the following conditions are met:
      - Index Finger is extended (pointing up)
      - Middle finger is extended
      - Ring finger is extended
      - Pinky finger is folded
      - Thumb is folded
    """
    if not lmList or len(lmList) < 21:
        return False
    # For an upward (extended) finger, the tip's y (lmList[][2]) should be less than the joint's y.
    index_extended = lmList[8][2] < lmList[6][2]
    
    # Middle finger extended (if it were extended) would be:
    middle_extended = lmList[12][2] < lmList[10][2]
    
    # For folded fingers, we want the tip to be lower (greater y) than the joint.
    ring_folded = lmList[16][2] > lmList[14][2]
    pinky_folded = lmList[20][2] > lmList[18][2]
    
    # For the left hand, an extended thumb would have its tip to the right (greater x)
    # than landmark 3. Since we want it folded, we want the opposite.
    thumb_extended = lmList[4][1] > lmList[3][1]
    
    return index_extended and middle_extended and (not thumb_extended) and (not ring_folded) and pinky_folded

def is_four_fingers(lmList):
    """
    For the left hand: Returns True if exactly four fingers are up (thumb folded).
    - Thumb folded (tip NOT to the right of joint 3).
    - Index, middle, ring, pinky extended (tips above joints).
    """
    if not lmList or len(lmList) < 21:
        return False
    thumb_folded = lmList[4][1] <= lmList[3][1]
    index_extended = lmList[8][2] < lmList[6][2]
    middle_extended = lmList[12][2] < lmList[10][2]
    ring_extended = lmList[16][2] < lmList[14][2]
    pinky_extended = lmList[20][2] < lmList[18][2]
    fingers_up = [index_extended, middle_extended, ring_extended, pinky_extended]
    return thumb_folded and sum(fingers_up) == 4

def is_open_palm_right(lmList):
    """
    For the right hand: Returns True if all five fingers are extended.
    - Thumb is extended if its tip (landmark 4) lies to the LEFT of landmark 3.
    - For index, middle, ring, and pinky: the tip's y-coordinate should be less (higher on image) than the y-coordinate
      of the joint two indices before (e.g. landmark 8 < landmark 6).
    """
    if not lmList or len(lmList) < 21:
        return False
    fingers = []
    # Right-hand thumb: extended if tip is to the LEFT of landmark 3.
    if lmList[4][1] < lmList[3][1]:
        fingers.append(1)
    else:
        fingers.append(0)
    # Index finger: tip (8) above joint (6) means extended.
    if lmList[8][2] < lmList[6][2]:
        fingers.append(1)
    else:
        fingers.append(0)
    # Middle finger: tip (12) above joint (10).
    if lmList[12][2] < lmList[10][2]:
        fingers.append(1)
    else:
        fingers.append(0)
    # Ring finger: tip (16) above joint (14).
    if lmList[16][2] < lmList[14][2]:
        fingers.append(1)
    else:
        fingers.append(0)
    # Pinky finger: tip (20) above joint (18).
    if lmList[20][2] < lmList[18][2]:
        fingers.append(1)
    else:
        fingers.append(0)
    return sum(fingers) == 5

def is_pointer_right(lmList):
    """
    For the right hand: Returns True if only the index finger is extended.
    - Thumb is folded (tip LEFT of joint 3).
    - Index extended (tip above joint).
    - Middle, ring, pinky folded.
    """
    if not lmList or len(lmList) < 21:
        return False
    index_extended = lmList[8][2] < lmList[6][2]
    middle_extended = lmList[12][2] < lmList[10][2]
    ring_folded = lmList[16][2] > lmList[14][2]
    pinky_folded = lmList[20][2] > lmList[18][2]
    thumb_extended = lmList[4][1] < lmList[3][1]  # right thumb extended if tip is left of joint
    return index_extended and (not middle_extended) and (not thumb_extended) and ring_folded and pinky_folded

def is_two_fingers_right(lmList):
    """
    For the right hand: Returns True if index and middle fingers are extended, others folded.
    - Thumb folded (tip LEFT of joint 3).
    - Index, middle extended (tips above joints).
    - Ring, pinky folded.
    """
    if not lmList or len(lmList) < 21:
        return False
    index_extended = lmList[8][2] < lmList[6][2]
    middle_extended = lmList[12][2] < lmList[10][2]
    ring_folded = lmList[16][2] > lmList[14][2]
    pinky_folded = lmList[20][2] > lmList[18][2]
    thumb_extended = lmList[4][1] < lmList[3][1]  # right thumb extended if tip is left of joint
    return index_extended and middle_extended and ring_folded and pinky_folded and (not thumb_extended)

def is_three_fingers_right(lmList):
    """
    For the right hand: Returns True if index, middle, and ring fingers are extended, others folded.
    - Thumb folded (tip LEFT of joint 3).
    - Index, middle, ring extended (tips above joints).
    - Pinky folded.
    """
    if not lmList or len(lmList) < 21:
        return False
    index_extended = lmList[8][2] < lmList[6][2]
    middle_extended = lmList[12][2] < lmList[10][2]
    ring_extended = lmList[16][2] < lmList[14][2]
    pinky_folded = lmList[20][2] > lmList[18][2]
    thumb_extended = lmList[4][1] < lmList[3][1]  # right thumb extended if tip is left of joint
    return index_extended and middle_extended and ring_extended and pinky_folded and (not thumb_extended)

def is_four_fingers_right(lmList):
    """
    For the right hand: Returns True if exactly four fingers are up (thumb folded).
    - Thumb folded (tip LEFT of joint 3).
    - Index, middle, ring, pinky extended (tips above joints).
    """
    if not lmList or len(lmList) < 21:
        return False
    thumb_folded = lmList[4][1] >= lmList[3][1]
    index_extended = lmList[8][2] < lmList[6][2]
    middle_extended = lmList[12][2] < lmList[10][2]
    ring_extended = lmList[16][2] < lmList[14][2]
    pinky_extended = lmList[20][2] < lmList[18][2]
    fingers_up = [index_extended, middle_extended, ring_extended, pinky_extended]
    return thumb_folded and sum(fingers_up) == 4

def is_five_fingers_right(lmList):
    """
    For the right hand: Returns True if all five fingers are up (open palm).
    - Thumb extended (tip LEFT of joint 3).
    - Index, middle, ring, pinky extended (tips above joints).
    """
    if not lmList or len(lmList) < 21:
        return False
    thumb_extended = lmList[4][1] < lmList[3][1]
    index_extended = lmList[8][2] < lmList[6][2]
    middle_extended = lmList[12][2] < lmList[10][2]
    ring_extended = lmList[16][2] < lmList[14][2]
    pinky_extended = lmList[20][2] < lmList[18][2]
    fingers_up = [thumb_extended, index_extended, middle_extended, ring_extended, pinky_extended]
    return sum(fingers_up) == 5

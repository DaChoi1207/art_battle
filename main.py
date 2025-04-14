import cv2
import time
from hand_detection import HandDetector, is_open_palm, is_yolo, is_two_fingers, is_pointer, is_three_fingers, is_pointer_right, is_two_fingers_right, is_three_fingers_right, is_four_fingers_right, is_five_fingers_right, is_four_fingers 
from drawing import DrawingCanvas

def main():
    # Set maxHands=2 to capture both left and right hands.
    cap = cv2.VideoCapture(0)
    detector = HandDetector(maxHands=2, detectionCon=0.7, trackCon=0.7)

    ret, frame = cap.read()
    if not ret:
        print("Failed to open camera")
        return

    # Initialize the drawing canvas with the dimensions of the frame.
    canvas = DrawingCanvas(frame.shape, line_color=(255, 255, 0), thickness=15)
    pTime = 0
    start_time = time.time()
    auto_saved = False

    while True:
        success, frame = cap.read()
        if not success:
            break
        # Flip the frame horizontally for mirror-like behavior.
        frame = cv2.flip(frame, 1)
        
        # Timer logic
        elapsed = int(time.time() - start_time)
        timer_text = f"Timer: {elapsed:02d}s"
        cv2.putText(frame, timer_text, (frame.shape[1] - 200, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)

        # Auto-save after 60 seconds
        if elapsed >= 60 and not auto_saved:
            canvas.save('drawing_save.png')
            auto_saved = True
            cv2.putText(frame, "Auto-saved as drawing_save.png", (10, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

        # Handle keyboard shortcuts
        key = cv2.waitKey(1) & 0xFF
        if key == ord('s'):
            canvas.save('drawing_save.png')
            cv2.putText(frame, "Saved as drawing_save.png", (10, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
            
        # Process the frame for hand detection.
        frame = detector.findHands(frame)
        
        # Initialize lists for left and right hand landmarks.
        left_lmList = None
        right_lmList = None
        
        # If any hands are detected, assign landmark lists to left/right.
        if detector.results.multi_hand_landmarks:
            for i, handLms in enumerate(detector.results.multi_hand_landmarks):
                # Get handedness from MediaPipe (labels: "Left" or "Right").
                handedness = detector.results.multi_handedness[i].classification[0].label
                # Use positional arguments instead of keywords.
                lmList = detector.findPosition(frame, i, False)
                if handedness == "Left":
                    left_lmList = lmList
                elif handedness == "Right":
                    right_lmList = lmList

        # For debugging, display gesture info based on the left hand.
        if left_lmList:
            if is_open_palm(left_lmList):
                cv2.putText(frame, "Left Open Palm", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            elif is_yolo(left_lmList):
                cv2.putText(frame, "Left YOLO", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            elif is_two_fingers(left_lmList):
                cv2.putText(frame, "Left Two Fingers", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            elif is_pointer(left_lmList):
                cv2.putText(frame, "Left Pointer", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)    
            elif is_three_fingers(left_lmList):
                cv2.putText(frame, "Left Three Fingers", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        drawing_active = False
        
        # Use left hand's open palm as the trigger for drawing mode.
        if left_lmList and is_pointer(left_lmList):
            cv2.putText(frame, "Drawing Mode Active", (10, 110),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            # Only draw if the right hand is also detected.
            if right_lmList:
                # Use right hand's index fingertip (landmark 8) as the drawing point.
                current_point = (right_lmList[8][1], right_lmList[8][2])
                drawing_active = True
                cv2.circle(frame, current_point, 8, (0, 255, 0), cv2.FILLED)
                canvas.update(current_point, drawing_active, is_eraser=False)
        elif left_lmList and is_two_fingers(left_lmList):
            cv2.putText(frame, "Eraser Mode Active", (10, 110),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            # Only erase if the right hand is also detected.
            if right_lmList:
                # Use right hand's index fingertip (landmark 8) as the eraser point.
                current_point = (right_lmList[8][1], right_lmList[8][2])
                drawing_active = True
                cv2.circle(frame, current_point, 8, (255, 0, 0), cv2.FILLED)
                canvas.update(current_point, drawing_active, is_eraser=True)
        elif left_lmList and is_three_fingers(left_lmList):
            cv2.putText(frame, "Change size mode Active", (10, 110),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            if right_lmList:
                # Get thumb tip (4) and index fingertip (8) positions
                thumb_tip = (right_lmList[4][1], right_lmList[4][2])
                index_tip = (right_lmList[8][1], right_lmList[8][2])
                # Calculate Euclidean distance
                dist = int(((thumb_tip[0] - index_tip[0]) ** 2 + (thumb_tip[1] - index_tip[1]) ** 2) ** 0.5)
                # Map distance to thickness range (5-70)
                min_dist, max_dist = 20, 200
                min_thick, max_thick = 5, 70
                thickness = int(min_thick + (max_thick - min_thick) * (dist - min_dist) / (max_dist - min_dist))
                thickness = max(min_thick, min(max_thick, thickness))
                canvas.thickness = thickness
                # Draw visual feedback
                cv2.putText(frame, f"Thickness: {thickness}", (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
                cv2.line(frame, thumb_tip, index_tip, (0, 0, 255), 4)
        elif left_lmList and is_four_fingers(left_lmList):
            cv2.putText(frame, "Undo or Redo Mode Active", (10, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            if right_lmList:
                if is_pointer_right(right_lmList):
                    # Use right hand's index fingertip (landmark 8) as the undo point.
                    current_point = (right_lmList[8][1], right_lmList[8][2])
                    drawing_active = True
                    canvas.undo()
                    cv2.putText(frame, "Undo-ing", (10, 110),
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                elif is_two_fingers_right(right_lmList):
                    # Use right hand's index fingertip (landmark 8) as the redo point.
                    current_point = (right_lmList[8][1], right_lmList[8][2])
                    drawing_active = True
                    cv2.putText(frame, "Redo-ing", (10, 110),
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                    canvas.redo()
        elif left_lmList and is_open_palm(left_lmList):
            cv2.putText(frame, "Change Colour Mode Active", (10, 110),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            if right_lmList:
                # If one finger is up
                if is_pointer_right(right_lmList):
                    canvas.line_color = (255, 0, 0)  # Blue
                    cv2.putText(frame, "Blue", (10, 150),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                # If two fingers are up
                elif is_two_fingers_right(right_lmList):
                    canvas.line_color = (0, 255, 0)  # Green
                    cv2.putText(frame, "Green", (10, 150),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                # If three fingers are up
                elif is_three_fingers_right(right_lmList):
                    canvas.line_color = (0, 0, 255)  # Red
                    cv2.putText(frame, "Red", (10, 150),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                # If four fingers are up
                elif is_four_fingers_right(right_lmList):
                    canvas.line_color = (255, 255, 0)  # Yellow
                    cv2.putText(frame, "Yellow", (10, 150),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                # If five fingers are up
                elif is_five_fingers_right(right_lmList):
                    canvas.line_color = (255, 255, 255)  # White
                    cv2.putText(frame, "White", (10, 150),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        else:
            # Reset drawing if trigger gesture is inactive.
            canvas.update(None, False)
        
        if left_lmList and is_yolo(left_lmList):
            canvas.clear()

        # Blend the drawing canvas with the live frame.
        frame = canvas.blend_with_frame(frame)

        # Calculate and display FPS.
        cTime = time.time()
        fps = 1 / (cTime - pTime) if (cTime - pTime) > 0 else 0
        pTime = cTime
        cv2.putText(frame, f"FPS: {int(fps)}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        cv2.imshow("Drawing", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
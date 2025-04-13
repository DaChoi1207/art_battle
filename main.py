import cv2
import time, math, numpy as np
import hand_detection as htm
import pyautogui, autopy
import subprocess
import os

wCam, hCam = 640, 480

def init_camera():
    cap = cv2.VideoCapture(0)  # Try camera index 0 first
    if not cap.isOpened():
        # If camera 0 fails, try camera 1
        cap = cv2.VideoCapture(1)
        if not cap.isOpened():
            print("Could not open camera")
            return None
    
    # Set camera properties
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, wCam)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, hCam)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    return cap

# Initialize camera
cap = init_camera()
if cap is None:
    print("Failed to initialize camera")
    exit(1)

pTime = 0

detector = htm.handDetector(maxHands=1, detectionCon=0.5, trackCon=0.5)

# Volume control variables
volRange = [0, 100]
minVol = volRange[0]
maxVol = volRange[1]
vol = 0
volBar = 400
volPer = 0

tipIds = [4, 8, 12, 16, 20]
mode = ''
active = 0

pyautogui.FAILSAFE = False
while True:
    success, img = cap.read()
    if not success:
        print("Failed to capture frame")
        continue

    img = detector.findHands(img)
    lmList = detector.findPosition(img, draw=False)
    
    fingers = []

    if len(lmList) != 0:

        #Thumb
        if lmList[tipIds[0]][1] > lmList[tipIds[0 -1]][1]:
            if lmList[tipIds[0]][1] >= lmList[tipIds[0] - 1][1]:
                fingers.append(1)
            else:
                fingers.append(0)
        elif lmList[tipIds[0]][1] < lmList[tipIds[0 -1]][1]:
            if lmList[tipIds[0]][1] <= lmList[tipIds[0] - 1][1]:
                fingers.append(1)
            else:
                fingers.append(0)

        for id in range(1,5):
            if lmList[tipIds[id]][2] < lmList[tipIds[id] - 2][2]:
                fingers.append(1)
            else:
                fingers.append(0)

        if (fingers == [0,0,0,0,0]) & (active == 0 ):
            mode='N'
        elif (fingers == [0, 1, 0, 0, 0] or fingers == [0, 1, 1, 0, 0]) & (active == 0 ):
            mode = 'Scroll'
            active = 1
        elif (fingers == [1, 1, 0, 0, 0] ) & (active == 0 ):
             mode = 'Volume'
             active = 1
        elif (fingers == [1 ,1 , 1, 1, 1] ) & (active == 0 ):
             mode = 'Cursor'
             active = 1

############# Scroll 👇👇👇👇##############
    if mode == 'Scroll':
        active = 1
        cv2.putText(img, str(mode), (250, 450), cv2.FONT_HERSHEY_COMPLEX_SMALL,
                    3, (0, 255, 255), 3)
        cv2.rectangle(img, (200, 410), (245, 460), (255, 255, 255), cv2.FILLED)
        if len(lmList) != 0:
            if fingers == [0,1,0,0,0]:
                cv2.putText(img, 'U', (200, 455), cv2.FONT_HERSHEY_COMPLEX, 2, (0, 255, 0), 2)
                pyautogui.scroll(300)

            if fingers == [0,1,1,0,0]:
                cv2.putText(img, 'D', (200, 455), cv2.FONT_HERSHEY_COMPLEX, 2, (0, 0, 255), 2)
                pyautogui.scroll(-300)
            elif fingers == [0, 0, 0, 0, 0]:
                active = 0
                mode = 'N'
################# Volume 👇👇👇####################
    if mode == 'Volume':
        active = 1
        cv2.putText(img, str(mode), (250, 450), cv2.FONT_HERSHEY_COMPLEX_SMALL,
                    3, (0, 255, 255), 3)
        if len(lmList) != 0:
            if fingers[-1] == 1:
                active = 0
                mode = 'N'
                print(mode)

            else:

                x1, y1 = lmList[4][1], lmList[4][2]
                x2, y2 = lmList[8][1], lmList[8][2]
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

                cv2.circle(img, (x1, y1), 15, (255, 0, 255), cv2.FILLED)
                cv2.circle(img, (x2, y2), 15, (255, 0, 255), cv2.FILLED)
                cv2.line(img, (x1, y1), (x2, y2), (255, 0, 255), 3)
                cv2.circle(img, (cx, cy), 15, (255, 0, 255), cv2.FILLED)

                length = math.hypot(x2 - x1, y2 - y1)
                
                vol = np.interp(length, [50, 300], [minVol, maxVol])
                volBar = np.interp(length, [50, 300], [400, 150])
                volPer = np.interp(length, [50, 300], [0, 100])
                
                os.system(f"osascript -e 'set volume output volume {int(vol)}'")

                if length < 50:
                    cv2.circle(img, (cx, cy), 15, (0, 255, 0), cv2.FILLED)

    cv2.rectangle(img, (50, 150), (85, 400), (255, 0, 0), 3)
    cv2.rectangle(img, (50, int(volBar)), (85, 400), (255, 0, 0), cv2.FILLED)
    cv2.putText(img, f'{int(volPer)} %', (40, 450), cv2.FONT_HERSHEY_COMPLEX,
                1, (255, 0, 0), 3)

    cTime = time.time()
    fps = 1 / (cTime - pTime)
    pTime = cTime

    cv2.putText(img, f'FPS: {int(fps)}', (40, 50), cv2.FONT_HERSHEY_COMPLEX,
                1, (255, 0, 0), 3)

    cv2.imshow("Image", img)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

    if mode == 'Cursor':
        active = 1
        cv2.putText(img, str(mode), (250, 450), cv2.FONT_HERSHEY_COMPLEX_SMALL,
                    3, (0, 255, 255), 3)
        cv2.rectangle(img, (110, 20), (620, 350), (255, 255, 255), 3)

        if fingers[1:] == [0,0,0,0]: #thumb excluded
            active = 0
            mode = 'N'
            print(mode)
        else:
            if len(lmList) != 0:
                x1, y1 = lmList[8][1], lmList[8][2]
                w, h = autopy.screen.size()
                X = int(np.interp(x1, [110, 620], [0, w - 1]))
                Y = int(np.interp(y1, [20, 350], [0, h - 1]))
                cv2.circle(img, (lmList[8][1], lmList[8][2]), 7, (255, 255, 255), cv2.FILLED)
                cv2.circle(img, (lmList[4][1], lmList[4][2]), 10, (0, 255, 0), cv2.FILLED)  #thumb

                if X%2 !=0:
                    X = X - X%2
                if Y%2 !=0:
                    Y = Y - Y%2
                print(X,Y)
                autopy.mouse.move(X,Y)
              #  pyautogui.moveTo(X,Y)
                if fingers[0] == 0:
                    cv2.circle(img, (lmList[4][1], lmList[4][2]), 10, (0, 0, 255), cv2.FILLED)  # thumb
                    pyautogui.click()

cap.release()
cv2.destroyAllWindows()
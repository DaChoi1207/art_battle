import cv2
import numpy as np

class DrawingCanvas:
    def __init__(self, frame_shape, line_color=(0, 0, 255), thickness=50):
        # Create a blank canvas with the same dimensions as the frame.
        self.canvas = np.zeros(frame_shape, dtype=np.uint8)
        self.line_color = line_color  # Bold red color (BGR format)
        self.thickness = thickness
        self.prev_point = None
        self.is_eraser = False
        self._undo_stack = []
        self._redo_stack = []

    @property
    def can_undo(self):
        return len(self._undo_stack) > 0

    @property
    def can_redo(self):
        return len(self._redo_stack) > 0

    def undo(self):
        if self.can_undo:
            self._redo_stack.append(self.canvas.copy())
            self.canvas = self._undo_stack.pop()

    def redo(self):
        if self.can_redo:
            self._undo_stack.append(self.canvas.copy())
            self.canvas = self._redo_stack.pop()

    def update(self, current_point, drawing_active, is_eraser=False):
        """
        Update canvas with a line if drawing is active.
        - current_point: tuple (x, y) from fingertip.
        - drawing_active: boolean flag indicating if the drawing gesture is active.
        - is_eraser: boolean flag indicating if we should erase (remove drawing) rather than draw.
        """
        if not drawing_active:
            self.prev_point = None
            return

        if self.prev_point is not None and current_point is not None:
            # Save state for undo before drawing/erasing
            self._undo_stack.append(self.canvas.copy())
            self._redo_stack.clear()
            if is_eraser:
                # Erase by drawing on the canvas in black (the blank canvas color)
                cv2.line(self.canvas, self.prev_point, current_point, (0, 0, 0), self.thickness + 10)
                # Also add a filled circle to ensure the area is completely cleared
                cv2.circle(self.canvas, current_point, (self.thickness // 2) + 5, (0, 0, 0), thickness=-1)
            else:
                # Draw normally with the chosen line color
                cv2.line(self.canvas, self.prev_point, current_point, self.line_color, self.thickness)

        self.prev_point = current_point


    def blend_with_frame(self, frame, alpha=0.3):
        """
        Blends the canvas with the video frame.
        - alpha: weight of the canvas in the blending process.
        """
        # Ensure the canvas has the same shape as the frame
        if self.canvas.shape != frame.shape:
            self.canvas = np.zeros(frame.shape, dtype=np.uint8)
        
        return cv2.addWeighted(frame, 1 - alpha, self.canvas, alpha, 0)

    def clear(self):
        """Clear the canvas."""
        self._undo_stack.append(self.canvas.copy())
        self._redo_stack.clear()
        self.canvas[:] = 0

    def save(self, filename):
        """Save the current canvas to a file."""
        cv2.imwrite(filename, self.canvas)

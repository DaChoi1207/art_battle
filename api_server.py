from fastapi import FastAPI, Response, Body
import cv2
from drawing import DrawingCanvas
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, for development only!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app = FastAPI()
canvas = DrawingCanvas((480, 640, 3))  # Adjust shape as needed

@app.get("/canvas/image")
def get_canvas_image():
    _, img_encoded = cv2.imencode('.png', canvas.canvas)
    return Response(content=img_encoded.tobytes(), media_type="image/png")

@app.post("/canvas/clear")
def clear_canvas():
    canvas.clear()
    return {"status": "cleared"}

@app.post("/canvas/undo")
def undo_canvas():
    """Undo last action on the canvas."""
    canvas.undo()
    return {"status": "undone"}

@app.post("/canvas/redo")
def redo_canvas():
    """Redo last undone action on the canvas."""
    canvas.redo()
    return {"status": "redone"}

@app.post("/canvas/draw")
def draw_line(
    start: list = Body(...),
    end: list = Body(...),
    is_eraser: bool = Body(False)
):
    """Draw a line from start to end. start/end are [x, y]. is_eraser makes the line erase instead of draw."""
    canvas.prev_point = tuple(start)
    canvas.update(tuple(end), True, is_eraser=is_eraser)
    return {"status": "line_drawn"}

@app.post("/canvas/color")
def set_color(color: list = Body(...)):
    """Set the pen color. color is [B, G, R]."""
    canvas.line_color = tuple(color)
    return {"status": "color_set"}

@app.post("/canvas/thickness")
def set_thickness(thickness: int = Body(...)):
    """Set pen thickness."""
    canvas.thickness = thickness
    return {"status": "thickness_set"}

@app.post("/canvas/save")
def save_canvas(filename: str = Body("drawing_save.png")):
    """Save the canvas to a file."""
    canvas.save(filename)
    return {"status": "saved", "filename": filename}

@app.get("/canvas/state")
def get_state():
    """Get current pen state and undo/redo availability."""
    return {
        "color": canvas.line_color,
        "thickness": canvas.thickness,
        "can_undo": canvas.can_undo,
        "can_redo": canvas.can_redo
    }

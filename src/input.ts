import type { Point } from "./simulation";
/** Native captured pointers work even if the finger leaves the initial joystick circle. */
export class MovementInput {
  keys = new Set<string>();
  stick = { id: -1, x: 0, y: 0, dx: 0, dy: 0 };
  enabled = false;
  constructor(
    private canvas: HTMLCanvasElement,
    private ui: HTMLElement,
  ) {
    window.addEventListener("keydown", (e) => {
      if (
        !this.enabled ||
        ![
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(e.key.toLowerCase())
      )
        return;
      e.preventDefault();
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener("keyup", (e) =>
      this.keys.delete(e.key.toLowerCase()),
    );
    canvas.addEventListener("pointerdown", (e) => {
      if (
        !this.enabled ||
        this.stick.id !== -1 ||
        e.clientY < innerHeight * 0.25
      )
        return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      this.stick = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        dx: 0,
        dy: 0,
      };
      ui.classList.add("active", "learned");
      this.paint();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.stick.id) return;
      e.preventDefault();
      const dx = e.clientX - this.stick.x,
        dy = e.clientY - this.stick.y,
        d = Math.max(48, Math.hypot(dx, dy));
      this.stick.dx = dx / d;
      this.stick.dy = dy / d;
      this.paint();
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      canvas.addEventListener(event, (e) => {
        if ((e as PointerEvent).pointerId === this.stick.id) this.release();
      });
    window.addEventListener("blur", () => this.release());
    document.addEventListener("visibilitychange", () => this.release());
  }
  paint() {
    this.ui.style.left = `${this.stick.x}px`;
    this.ui.style.top = `${this.stick.y}px`;
    this.ui.style.setProperty("--sx", `${this.stick.dx * 40}px`);
    this.ui.style.setProperty("--sy", `${this.stick.dy * 40}px`);
  }
  release() {
    const id = this.stick.id;
    this.stick.id = -1;
    this.stick.dx = 0;
    this.stick.dy = 0;
    this.keys.clear();
    this.ui.classList.remove("active");
    this.ui.style.left = "";
    this.ui.style.top = "";
    this.ui.style.setProperty("--sx", "0px");
    this.ui.style.setProperty("--sy", "0px");
    if (id !== -1 && this.canvas.hasPointerCapture(id))
      this.canvas.releasePointerCapture(id);
  }
  screenVector(): Point {
    const x =
        this.stick.dx +
        Number(this.keys.has("d") || this.keys.has("arrowright")) -
        Number(this.keys.has("a") || this.keys.has("arrowleft")),
      y =
        this.stick.dy +
        Number(this.keys.has("s") || this.keys.has("arrowdown")) -
        Number(this.keys.has("w") || this.keys.has("arrowup"));
    const n = Math.max(1, Math.hypot(x, y));
    return { x: x / n, y: y / n };
  }
}

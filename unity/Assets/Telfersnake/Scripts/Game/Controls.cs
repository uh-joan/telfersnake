using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;

namespace Telfer.Game
{
    /// <summary>
    /// One thumb (or one mouse) is enough. Touch: drag anywhere for a floating joystick, a second
    /// finger dashes. Mouse: the snake chases the pointer, hold a button to dash. Keys: WASD or
    /// arrows, space to dash. Gamepad: left stick, south button or trigger to dash.
    /// Output is a direction in screen space (x right, y up), which with the camera's fixed
    /// north-up view is also a compass direction.
    /// </summary>
    public sealed class Controls
    {
        public Vector2 Steer;       // normalised; zero = hands off
        public bool Dash;
        public bool Active => Steer.sqrMagnitude > 0.01f;

        // Floating joystick state, for the HUD to draw.
        public bool StickOn;
        public Vector2 StickBase, StickKnob;

        float mouseIdle = 99;
        Vector2 lastMouse;
        int stickFinger = -1;
        public bool DashButtonHeld;

        public Controls()
        {
            if (!EnhancedTouchSupport.enabled) EnhancedTouchSupport.Enable();
        }

        /// <summary>`headScreen` is where the player's head is on screen (pixels).</summary>
        public void Update(Vector2 headScreen, float dt, bool uiBlocking)
        {
            Steer = Vector2.zero;
            Dash = DashButtonHeld;
            StickOn = false;

            // Keyboard.
            var kb = Keyboard.current;
            if (kb != null)
            {
                var k = Vector2.zero;
                if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) k.x -= 1;
                if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) k.x += 1;
                if (kb.wKey.isPressed || kb.upArrowKey.isPressed) k.y += 1;
                if (kb.sKey.isPressed || kb.downArrowKey.isPressed) k.y -= 1;
                if (k.sqrMagnitude > 0) { Steer = k.normalized; mouseIdle = 99; }
                if (kb.spaceKey.isPressed || kb.leftShiftKey.isPressed) Dash = true;
            }

            // Gamepad.
            var pad = Gamepad.current;
            if (pad != null)
            {
                var s = pad.leftStick.ReadValue();
                if (s.magnitude > 0.25f) { Steer = s.normalized; mouseIdle = 99; }
                if (pad.buttonSouth.isPressed || pad.rightTrigger.ReadValue() > 0.4f) Dash = true;
            }

            // Touch: the first finger down (not on a button) becomes a floating joystick.
            if (Touch.activeTouches.Count > 0)
            {
                Touch? stick = null;
                int fingers = 0;
                foreach (var t in Touch.activeTouches)
                {
                    fingers++;
                    if (stickFinger < 0 && t.phase == UnityEngine.InputSystem.TouchPhase.Began && !uiBlocking && !DashButtonHeld) stickFinger = t.finger.index;
                    if (t.finger.index == stickFinger) stick = t;
                }
                if (stick.HasValue)
                {
                    var t = stick.Value;
                    StickOn = true;
                    StickBase = t.startScreenPosition;
                    var d = t.screenPosition - t.startScreenPosition;
                    float max = Screen.dpi > 0 ? Screen.dpi * 0.45f : 90;
                    if (d.magnitude > max) StickBase = t.screenPosition - d.normalized * max;
                    StickKnob = t.screenPosition;
                    if (d.magnitude > 10) Steer = d.normalized;
                    if (t.phase == UnityEngine.InputSystem.TouchPhase.Ended || t.phase == UnityEngine.InputSystem.TouchPhase.Canceled) stickFinger = -1;
                    if (fingers >= 2) Dash = true;
                }
                else stickFinger = -1;
                mouseIdle = 99;
                return;
            }
            stickFinger = -1;

            // Mouse: follow the pointer while it is in use.
            var mouse = Mouse.current;
            if (mouse != null && Steer == Vector2.zero)
            {
                var p = mouse.position.ReadValue();
                if ((p - lastMouse).sqrMagnitude > 4 || mouse.leftButton.isPressed) mouseIdle = 0;
                lastMouse = p;
                mouseIdle += dt;
                bool inside = p.x >= 0 && p.y >= 0 && p.x <= Screen.width && p.y <= Screen.height;
                if (inside && mouseIdle < 4 && !uiBlocking)
                {
                    var d = p - headScreen;
                    if (d.magnitude > 18) Steer = d.normalized;
                }
                // Hold a button to dash, slither.io style.
                if (!uiBlocking && (mouse.leftButton.isPressed || mouse.rightButton.isPressed)) Dash = true;
            }
        }

        public static bool Pressed(Key k) => Keyboard.current != null && Keyboard.current[k].wasPressedThisFrame;
        public static bool PadPressed(System.Func<Gamepad, UnityEngine.InputSystem.Controls.ButtonControl> b) => Gamepad.current != null && b(Gamepad.current).wasPressedThisFrame;
    }
}

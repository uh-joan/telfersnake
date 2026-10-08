using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;

namespace Telfer.Game
{
    /// <summary>
    /// One thumb (or one mouse) is enough. Touch: drag anywhere for a floating joystick; tap then
    /// press-and-hold anywhere to dash (keep dragging to steer while it bursts), or a second finger. Mouse: the snake chases the pointer, hold a button to dash. Keys: WASD or
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

        // Tap-then-hold dashes, as in the web game (controls.ts): a quick touch that barely moved is a
        // tap, and a press that starts soon after and close by bursts until that finger lifts.
        const float TAP_MAX_TIME = 0.25f, TAP_MAX_MOVE = 24, DOUBLE_TAP_TIME = 0.32f, DOUBLE_TAP_RADIUS = 90;
        bool dashTouch, movedFar;
        float tapAt = -99;
        Vector2 tapPos;

        /// <summary>CSS pixels to screen pixels, so the web game's thresholds feel the same here.</summary>
        static float Px => Screen.dpi > 0 ? Mathf.Max(1, Screen.dpi / 96f) : 1;

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
                    if (stickFinger < 0 && t.phase == UnityEngine.InputSystem.TouchPhase.Began && !uiBlocking && !DashButtonHeld)
                    {
                        stickFinger = t.finger.index;
                        float now = Time.unscaledTime;
                        dashTouch = now - tapAt < DOUBLE_TAP_TIME && (t.screenPosition - tapPos).magnitude < DOUBLE_TAP_RADIUS * Px;
                        tapAt = -99;
                        movedFar = false;
                    }
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
                    if (d.magnitude > TAP_MAX_MOVE * Px) movedFar = true;
                    if (dashTouch || fingers >= 2) Dash = true;
                    if (t.phase == UnityEngine.InputSystem.TouchPhase.Ended || t.phase == UnityEngine.InputSystem.TouchPhase.Canceled)
                    {
                        // A quick touch that stayed put is a tap: the next press, if it comes at once, bursts.
                        float held = (float)(t.time - t.startTime);
                        if (t.phase == UnityEngine.InputSystem.TouchPhase.Ended && !dashTouch && !movedFar && held < TAP_MAX_TIME)
                        {
                            tapAt = Time.unscaledTime;
                            tapPos = t.screenPosition;
                        }
                        dashTouch = false;
                        stickFinger = -1;
                    }
                }
                else { stickFinger = -1; dashTouch = false; }
                mouseIdle = 99;
                return;
            }
            stickFinger = -1;
            dashTouch = false;

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

import gymnasium as gym
import numpy as np
from gymnasium import spaces


class MeowlympicsEnv(gym.Env):
    # Match Phaser config values exactly
    GRAVITY          = 2000
    JUMP_VELOCITY    = -900
    GROUND_Y         = 582
    MAX_JUMPS        = 2
    BASE_SPEED       = 300
    MAX_SPEED        = 700
    MAX_HAZARDS_TRACKED = 3

    def __init__(self):
        super().__init__()

        # [player_y, player_vy, jumps_left, speed, (haz_x, haz_h) x3]
        self.observation_space = spaces.Box(
            low=-1.0, high=1.0,
            shape=(4 + self.MAX_HAZARDS_TRACKED * 2,),
            dtype=np.float32
        )

        # 0 = nothing  1 = jump  2 = move left  3 = move right
        self.action_space = spaces.Discrete(4)

        self.dt = 1 / 60  # simulate at 60 fps, matching Phaser's loop

    # ── Reset ────────────────────────────────────────────────────────────────

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        self.player_x   = 100.0
        self.player_y   = 450.0
        self.player_vy  = 0.0
        self.player_vx  = 0.0
        self.jumps_left = self.MAX_JUMPS
        self.timer      = 0.0
        self.hazards    = []       # list of dicts: {x, y, w, h}
        self.spawn_timer    = 0.0
        self.next_spawn_at  = 1.5  # seconds until first hazard
        self.speed      = float(self.BASE_SPEED)

        return self._get_obs(), {}

    # ── Step ─────────────────────────────────────────────────────────────────

    def step(self, action):
        # Apply action
        if action == 1 and self.jumps_left > 0:
            self.player_vy  = self.JUMP_VELOCITY
            self.jumps_left -= 1
        elif action == 2:
            self.player_vx = -500.0
        elif action == 3:
            self.player_vx = 500.0
        else:
            self.player_vx = 0.0

        # Physics
        self.player_vy += self.GRAVITY * self.dt
        self.player_y  += self.player_vy * self.dt
        self.player_x  += self.player_vx * self.dt
        self.player_x   = np.clip(self.player_x, 0, 1200)

        # Ground collision — resets jumps, matching the Phaser collider callback
        if self.player_y >= self.GROUND_Y:
            self.player_y   = self.GROUND_Y
            self.player_vy  = 0.0
            self.jumps_left = self.MAX_JUMPS

        # Advance timer and update speed ramp
        self.timer += self.dt
        progress    = min(self.timer / 45.0, 1.0)
        self.speed  = self.BASE_SPEED + progress * (self.MAX_SPEED - self.BASE_SPEED)

        self._update_hazards()

        terminated = self._check_collision()

        # Reward: +dt per frame survived, -1 on death
        reward = -1.0 if terminated else self.dt

        return self._get_obs(), reward, terminated, False, {}

    # ── Hazards ──────────────────────────────────────────────────────────────

    def _update_hazards(self):
        self.spawn_timer += self.dt
        if self.spawn_timer >= self.next_spawn_at:
            self.spawn_timer = 0.0
            difficulty = min(self.timer / 30.0, 1.0)
            self.next_spawn_at = float(np.random.uniform(
                max(0.8, 2.4 - difficulty * 1.6),
                max(1.2, 2.4 - difficulty * 0.8),
            ))
            h = float(np.random.uniform(40, 90))
            self.hazards.append({
                "x": 1200.0,
                "y": self.GROUND_Y,
                "w": 40.0,
                "h": h,
            })

        for haz in self.hazards:
            haz["x"] -= self.speed * self.dt

        self.hazards = [h for h in self.hazards if h["x"] > -60]

    # ── Collision ────────────────────────────────────────────────────────────

    def _check_collision(self):
        # Hitbox matches Phaser: setSize(110, 150) setOffset(55, 60)
        px_left  = self.player_x - 55
        px_right = self.player_x + 55
        py_top   = self.player_y - 75
        py_bot   = self.player_y + 75

        for h in self.hazards:
            if (px_right > h["x"] and
                px_left  < h["x"] + h["w"] and
                py_top   < h["y"] and
                py_bot   > h["y"] - h["h"]):
                return True
        return False

    # ── Observation ──────────────────────────────────────────────────────────

    def _get_obs(self):
        # Sort by x ascending so nearest hazard is always at index 0
        sorted_hazards = sorted(self.hazards, key=lambda h: h["x"])
        sorted_hazards = sorted_hazards[:self.MAX_HAZARDS_TRACKED]

        obs = [
            self.player_y / 650.0,
            self.player_vy / 2000.0,
            self.jumps_left / self.MAX_JUMPS,
            self.speed / self.MAX_SPEED,
        ]

        for i in range(self.MAX_HAZARDS_TRACKED):
            if i < len(sorted_hazards):
                obs += [
                    sorted_hazards[i]["x"] / 1200.0,
                    sorted_hazards[i]["h"] / 200.0,
                ]
            else:
                obs += [1.0, 0.0]  # no hazard = far away, zero height

        return np.array(obs, dtype=np.float32)
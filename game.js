var config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 650,
  backgroundColor: 0xd19670,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 2000 },
      debug: false,
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
    extend: {
      timer: 0,
      highScore: 0,
      timeText: undefined,
      highScoreText: undefined,
      gameRunning: false,
    },
  },
};

var game = new Phaser.Game(config);
var ground;
var player;
var cursors;
var hazards;
var startButton;
var startText;
var titleText;
var titleShadow;
var controlsHint;

var minSpawnInterval = 800;
var maxSpawnInterval = 2400;

var BASE_HAZARD_SPEED = 300;
var MAX_HAZARD_SPEED = 700;
var currentHazardSpeed = BASE_HAZARD_SPEED;

var jumpsLeft = 0;
var MAX_JUMPS = 2;

var MILESTONES = [10, 20, 30, 45, 60, 90, 120];
var shownMilestones = {};

var isDead = false;

// ─── PRELOAD ──────────────────────────────────────────────────────────────────

function preload() {
  this.load.audio("backgroundAudio", "assets/light_piano_background_music.mp3");
  this.load.image("background1", "assets/background.png");

  this.load.image("hazardImage1", "assets/temp-hazard.png");
  this.load.image("hazardImage2", "assets/temp-hazard2.png");
  this.load.image("hazardImage3", "assets/temp-hazard3.png");
  this.load.spritesheet("cat", "assets/spritesheet.png", {
    frameWidth: 224,
    frameHeight: 218,
  });
}

// ─── START SCREEN ─────────────────────────────────────────────────────────────

function createStartScreen() {
  const { width, height } = this.scale;

  // Auto-scale the tile to fit the canvas height, then it tiles horizontally as it scrolls
  var bgSrc = this.textures.get("background1").getSourceImage();
  var bgScale = height / bgSrc.height;
  this.bg = this.add
    .tileSprite(0, 0, width, height, "background1")
    .setTileScale(bgScale, bgScale)
    .setOrigin(0, 0)
    .setDepth(0);

  // Title with drop shadow effect (two overlapping texts)
  titleShadow = this.add
    .text(603, 138, "Meowlympics", {
      fontSize: "120px",
      fill: "#00000055",
      fontFamily: "Mochiy Pop One, sans-serif",
    })
    .setOrigin(0.5)
    .setDepth(9);

  titleText = this.add
    .text(600, 135, "Meowlympics", {
      fontSize: "120px",
      fill: "#fff",
      fontFamily: "Mochiy Pop One, sans-serif",
    })
    .setOrigin(0.5)
    .setDepth(10);

  // Controls hint — plain ASCII, Mochiy Pop One handles it fine
  controlsHint = this.add
    .text(600, 268, "UP or SPACE to jump   |   LEFT / RIGHT to move", {
      fontSize: "18px",
      fill: "#ffffffaa",
      fontFamily: "Mochiy Pop One, sans-serif",
    })
    .setOrigin(0.5)
    .setDepth(10);

  startText = this.add
    .text(600, 300, "Press Start", {
      fontSize: "34px",
      fill: "#FFD700",
      fontFamily: "VT323, sans-serif",
    })
    .setOrigin(0.5)
    .setDepth(10);

  // Pulse the "Press Start" text gently
  this.tweens.add({
    targets: startText,
    alpha: 0.3,
    duration: 800,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  // Start button with hover effects
  startButton = this.add
    .text(600, 348, "  Start Game  ", {
      fontSize: "28px",
      fill: "#fff",
      fontFamily: "VT323, sans-serif",
      backgroundColor: "#2d6a27",
      padding: { x: 28, y: 10 },
    })
    .setOrigin(0.5)
    .setDepth(10);

  startButton.setInteractive({ useHandCursor: true });

  startButton.on(
    "pointerover",
    function () {
      this.tweens.add({
        targets: startButton,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 100,
      });
      startButton.setStyle({ backgroundColor: "#4C8A46" });
    },
    this,
  );

  startButton.on(
    "pointerout",
    function () {
      this.tweens.add({
        targets: startButton,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
      });
      startButton.setStyle({ backgroundColor: "#2d6a27" });
    },
    this,
  );

  startButton.on("pointerdown", startGame, this);
}

// ─── START GAME (shows countdown first) ───────────────────────────────────────

function startGame() {
  // Tear down start screen — destroy only the known start screen elements,
  // NOT a blanket forEach that would also wipe timeText / highScoreText
  if (startButton) {
    startButton.destroy();
    startButton = null;
  }
  if (startText) {
    startText.destroy();
    startText = null;
  }
  if (titleText) {
    titleText.destroy();
    titleText = null;
  }
  if (titleShadow) {
    titleShadow.destroy();
    titleShadow = null;
  }
  if (controlsHint) {
    controlsHint.destroy();
    controlsHint = null;
  }

  // Show HUD now so it's visible during countdown
  this.timeText.setVisible(true);
  this.highScoreText.setVisible(true);
  this.hudGfx.setVisible(true);
  this.jumpPipContainer.setVisible(true);

  runCountdown.call(this);
}

function runCountdown() {
  var scene = this;
  var steps = ["3", "2", "1", "GO!"];
  var stepIdx = 0;

  function showStep() {
    var label = steps[stepIdx];
    var isGo = label === "GO!";

    var countText = scene.add
      .text(600, 325, label, {
        fontSize: isGo ? "100px" : "140px",
        fill: isGo ? "#FFD700" : "#ffffff",
        fontFamily: "Mochiy Pop One, sans-serif",
        stroke: "#000",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0)
      .setScale(0.5);

    // Pop in
    scene.tweens.add({
      targets: countText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: "Back.easeOut",
      onComplete: function () {
        // Hold then fade
        scene.time.delayedCall(isGo ? 400 : 550, function () {
          scene.tweens.add({
            targets: countText,
            alpha: 0,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 200,
            onComplete: function () {
              countText.destroy();
              stepIdx++;
              if (stepIdx < steps.length) {
                showStep();
              } else {
                beginGameplay.call(scene);
              }
            },
          });
        });
      },
    });
  }

  showStep();
}

function beginGameplay() {
  this.timer = 0;
  this.gameRunning = true;
  isDead = false;
  currentHazardSpeed = BASE_HAZARD_SPEED;
  jumpsLeft = MAX_JUMPS;
  shownMilestones = {};

  if (this.backgroundAudio) this.backgroundAudio.stop();
  this.backgroundAudio = this.sound.add("backgroundAudio", { loop: true });
  this.backgroundAudio.play();

  scheduleNextHazard.call(this);
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

function create() {
  createStartScreen.call(this);

  // Ground — thin rectangle matching the sandy bottom of the background
  var groundGfx = this.make.graphics({ add: false });
  groundGfx.fillStyle(0xd19670, 1);
  groundGfx.fillRect(0, 0, 1200, 18);
  groundGfx.generateTexture("groundTex", 1200, 18);
  groundGfx.destroy();

  ground = this.physics.add.staticGroup();
  ground.create(600, 591, "groundTex").setAlpha(0);

  player = this.physics.add.sprite(100, 450, "cat");
  player.setBounce(0);
  player.setCollideWorldBounds(true);
  player.setDepth(5);
  // The frame is 225x225 but the dog only occupies the center portion —
  // shrink the physics body to match the actual character and offset it inward
  player.setSize(110, 150);
  player.setOffset(55, 60);

  this.anims.create({
    key: "left",
    frames: this.anims.generateFrameNumbers("cat", { start: 0, end: 2 }),
    frameRate: 10,
    repeat: -1,
  });
  this.anims.create({
    key: "turn",
    frames: [{ key: "cat", frame: 0 }],
    frameRate: 20,
  });
  this.anims.create({
    key: "right",
    frames: this.anims.generateFrameNumbers("cat", { start: 1, end: 2 }),
    frameRate: 10,
    repeat: -1,
  });

  // Reset jumps on landing
  this.physics.add.collider(
    player,
    ground,
    function () {
      if (this.jumpRotateTween) {
        this.jumpRotateTween.stop();
        this.jumpRotateTween = null;
      }
      player.setAngle(0);
      jumpsLeft = MAX_JUMPS;
    },
    null,
    this,
  );

  hazards = this.physics.add.group();
  this.physics.add.collider(hazards, ground, function (hazard) {
    hazard.destroy();
  });

  // ── Speed vignette ──
  this.vignette = this.add
    .rectangle(600, 325, 1200, 650, 0xcc1100)
    .setAlpha(0)
    .setDepth(15);

  // ── HUD background pills ──
  this.hudGfx = this.add.graphics().setDepth(19).setVisible(false);
  this.hudGfx.fillStyle(0x000000, 0.5);
  this.hudGfx.fillRoundedRect(16, 14, 250, 46, 12); // high score pill (left)
  this.hudGfx.fillRoundedRect(934, 14, 250, 46, 12); // timer pill (right)

  // ── Jump pip indicators ──
  // Generate two textures: filled (jump available) and hollow (jump used)
  var pipFull = this.make.graphics({ add: false });
  pipFull.fillStyle(0xffffff, 1);
  pipFull.fillCircle(9, 9, 9);
  pipFull.generateTexture("pip-full", 18, 18);
  pipFull.destroy();

  var pipEmpty = this.make.graphics({ add: false });
  pipEmpty.lineStyle(2, 0xffffff, 0.5);
  pipEmpty.strokeCircle(9, 9, 8);
  pipEmpty.generateTexture("pip-empty", 18, 18);
  pipEmpty.destroy();

  // Container so pips follow a single setVisible call
  this.jumpPipContainer = this.add
    .container(0, 0)
    .setDepth(20)
    .setVisible(false);
  this.jumpPips = [];
  for (var i = 0; i < MAX_JUMPS; i++) {
    var pip = this.add.image(44 + i * 26, 624, "pip-full");
    this.jumpPipContainer.add(pip);
    this.jumpPips.push(pip);
  }
  // Small label next to pips
  var pipLabel = this.add.text(44 + MAX_JUMPS * 26 + 6, 616, "jumps", {
    fontSize: "16px",
    fill: "#ffffff88",
    fontFamily: "VT323, sans-serif",
  });
  this.jumpPipContainer.add(pipLabel);

  this.highScore = localStorage.getItem("highScore") || 0;

  // origin(0.5, 0.5) centers the text inside the pill — pill center y = 14 + 23 = 37
  this.highScoreText = this.add
    .text(141, 37, "Best: " + Math.floor(this.highScore / 1000) + "s", {
      fontSize: "24px",
      fill: "#FFD700",
      fontFamily: "VT323, sans-serif",
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false)
    .setDepth(20);

  this.timeText = this.add
    .text(1059, 37, "Time: 0s", {
      fontSize: "24px",
      fill: "#ffffff",
      fontFamily: "VT323, sans-serif",
    })
    .setOrigin(0.5, 0.5)
    .setVisible(false)
    .setDepth(20);

  cursors = this.input.keyboard.createCursorKeys();
  this.spaceKey = this.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SPACE,
  );
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

function update() {
  if (this.bg) this.bg.tilePositionX += 0.5 / (this.bg.tileScaleX || 1);

  // Update jump pips every frame (cheap — just swaps texture key)
  if (this.jumpPips && this.gameRunning) {
    for (var i = 0; i < MAX_JUMPS; i++) {
      this.jumpPips[i].setTexture(i < jumpsLeft ? "pip-full" : "pip-empty");
    }
  }

  if (!this.gameRunning || isDead) return;

  // ── Movement ──
  var isOnGround = player.body.touching.down;
  if (cursors.left.isDown) {
    player.setVelocityX(-500);
    player.anims.play("left", true);
  } else if (cursors.right.isDown) {
    player.setVelocityX(500);
    player.anims.play("right", true);
  } else {
    player.setVelocityX(0);
    player.anims.play("turn");
  }

  // ── Double jump with spin ──
  var jumpPressed =
    Phaser.Input.Keyboard.JustDown(cursors.up) ||
    Phaser.Input.Keyboard.JustDown(this.spaceKey);
  if (jumpPressed && jumpsLeft > 0) {
    player.setVelocityY(-900);
    jumpsLeft--;

    if (this.jumpRotateTween) this.jumpRotateTween.stop();
    player.setAngle(0);
    this.jumpRotateTween = this.tweens.add({
      targets: player,
      angle: 360,
      duration: 500,
      ease: "Sine.easeOut",
    });
  }

  // ── Timer ──
  this.timer += this.game.loop.delta;
  var seconds = Math.floor(this.timer / 1000);
  this.timeText.setText("Time: " + seconds + "s");

  // ── Speed ramp ──
  var speedProgress = Math.min(this.timer / 45000, 1);
  currentHazardSpeed = Phaser.Math.Linear(
    BASE_HAZARD_SPEED,
    MAX_HAZARD_SPEED,
    speedProgress,
  );
  hazards.getChildren().forEach(function (h) {
    if (h.active) h.setVelocityX(-currentHazardSpeed);
  });

  // ── Vignette ──
  if (this.vignette) this.vignette.setAlpha(speedProgress * 0.12);

  // ── Milestones ──
  MILESTONES.forEach(function (ms) {
    if (seconds >= ms && !shownMilestones[ms]) {
      shownMilestones[ms] = true;
      showMilestone.call(this, ms + "s!");
    }
  }, this);
}

// ─── MILESTONE POPUP ──────────────────────────────────────────────────────────

function showMilestone(label) {
  var popup = this.add
    .text(600, 200, label, {
      fontSize: "72px",
      fill: "#FFD700",
      fontFamily: "Mochiy Pop One, sans-serif",
      stroke: "#000",
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(25)
    .setAlpha(0)
    .setScale(0.7);

  // Pop in then float away
  this.tweens.add({
    targets: popup,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 150,
    ease: "Back.easeOut",
    onComplete: function () {
      this.tweens.add({
        targets: popup,
        y: 120,
        alpha: 0,
        duration: 1200,
        ease: "Power2",
        onComplete: function () {
          popup.destroy();
        },
      });
    },
    callbackScope: this,
  });
}

// ─── HAZARD SPAWNING ──────────────────────────────────────────────────────────

function scheduleNextHazard() {
  var elapsed = this.timer || 0;
  var difficulty = Math.min(elapsed / 30000, 1);
  var minDelay = Phaser.Math.Linear(
    maxSpawnInterval * 0.6,
    minSpawnInterval,
    difficulty,
  );
  var maxDelay = Phaser.Math.Linear(
    maxSpawnInterval,
    minSpawnInterval * 1.5,
    difficulty,
  );
  var delay = Phaser.Math.Between(Math.floor(minDelay), Math.floor(maxDelay));

  this.time.addEvent({
    delay: delay,
    callback: spawnHazard,
    callbackScope: this,
    loop: false,
  });
}

function spawnHazard() {
  if (!this.gameRunning || isDead) return;
  scheduleNextHazard.call(this);

  var randomHazardKey = Phaser.Math.RND.pick([
    "hazardImage1",
    "hazardImage2",
    "hazardImage3",
  ]);
  var hazard = hazards.create(1200, 582, randomHazardKey);
  hazard.setVelocityX(-currentHazardSpeed);
  hazard.setOrigin(0, 1);
  hazard.setDepth(4);
  hazard.setScale(1);

  this.physics.world.enable(hazard);
  hazard.body.allowGravity = false;

  this.physics.add.collider(
    player,
    hazard,
    function () {
      if (!isDead) {
        isDead = true;
        setTimeout(() => {
          gameOver.call(this);
        }, 10);
      }
    },
    null,
    this,
  );
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────

function gameOver() {
  this.gameRunning = false;
  this.cameras.main.shake(300, 0.018);

  this.tweens.add({
    targets: player,
    alpha: 0,
    duration: 80,
    yoyo: true,
    repeat: 4,
    onComplete: () => {
      player.setTint(0xff4444);
      this.physics.pause();
      showGameOverUI.call(this);
    },
  });

  if (this.timer > this.highScore) {
    this.highScore = this.timer;
    localStorage.setItem("highScore", this.highScore);
    this.highScoreText.setText(
      "Best: " + Math.floor(this.highScore / 1000) + "s",
    );
  }
}

function showGameOverUI() {
  var isNewBest =
    this.timer >= this.highScore && Math.floor(this.timer / 1000) > 0;
  var finalSecs = Math.floor(this.timer / 1000);

  // Dark panel slides down from above — taller so content has breathing room
  var panel = this.add
    .rectangle(600, -180, 520, 310, 0x000000, 0.75)
    .setDepth(28);
  var border = this.add
    .rectangle(600, -180, 524, 314, 0xffffff, 0.12)
    .setDepth(27);

  this.tweens.add({
    targets: [panel, border],
    y: 325,
    duration: 400,
    ease: "Back.easeOut",
  });

  // Panel spans y: 170 → 480 when settled at y=325 (height 310)
  // Content is distributed with comfortable padding from each edge
  var gameOverLabel = this.add
    .text(600, 232, "Game Over", {
      fontSize: "60px",
      fill: "#ffffff",
      fontFamily: "Mochiy Pop One, sans-serif",
      stroke: "#000",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(30)
    .setAlpha(0);

  var scoreLabel = this.add
    .text(600, 312, "Score: " + finalSecs + "s", {
      fontSize: "32px",
      fill: isNewBest ? "#FFD700" : "#ffffffcc",
      fontFamily: "VT323, sans-serif",
    })
    .setOrigin(0.5)
    .setDepth(30)
    .setAlpha(0);

  var newBestLabel = isNewBest
    ? this.add
        .text(600, 348, "★  New Best!  ★", {
          fontSize: "24px",
          fill: "#FFD700",
          fontFamily: "VT323, sans-serif",
        })
        .setOrigin(0.5)
        .setDepth(30)
        .setAlpha(0)
    : null;

  var restartY = isNewBest ? 408 : 378;
  var restartButton = this.add
    .text(600, restartY, "  Play Again  ", {
      fontSize: "26px",
      fill: "#fff",
      fontFamily: "VT323, sans-serif",
      backgroundColor: "#2d6a27",
      padding: { x: 28, y: 10 },
    })
    .setOrigin(0.5)
    .setDepth(30)
    .setAlpha(0);

  // Fade in contents after panel slides in
  var fadeTargets = [gameOverLabel, scoreLabel, restartButton];
  if (newBestLabel) fadeTargets.push(newBestLabel);

  this.time.delayedCall(
    380,
    function () {
      this.tweens.add({
        targets: fadeTargets,
        alpha: 1,
        duration: 250,
        ease: "Power1",
      });
    },
    [],
    this,
  );

  // Hover + click on restart
  restartButton.setInteractive({ useHandCursor: true });

  restartButton.on(
    "pointerover",
    function () {
      this.tweens.add({
        targets: restartButton,
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 100,
      });
      restartButton.setStyle({ backgroundColor: "#4C8A46" });
    },
    this,
  );

  restartButton.on(
    "pointerout",
    function () {
      this.tweens.add({
        targets: restartButton,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
      });
      restartButton.setStyle({ backgroundColor: "#2d6a27" });
    },
    this,
  );

  restartButton.on(
    "pointerdown",
    function () {
      this.scene.restart();
    },
    this,
  );
}

var config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 650,
    backgroundColor: 0x444444,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 2000 },
            debug: false
        }
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
        gameRunning: false
        }
    } 
};

var game = new Phaser.Game(config);
var ground;
var player;
var cursors;
var hazards;
var hazardSpeed = 300;
var hazardSpawnInterval = 1500; // milliseconds
var startButton;

function preload() {
    this.load.audio('backgroundAudio', 'assets/light_piano_background_music.mp3');
    this.load.image('ground', 'assets/floor.jpg');
    this.load.image('background1', 'assets/forest1.jpg');
    this.load.image('fog', 'assets/fog.png');
    this.load.image('foreground', 'assets/foreground.png');
    this.load.image('trees', 'assets/trees.png');
    
    this.load.image('hazardImage1', 'assets/temp-hazard.png');
    this.load.image('hazardImage2', 'assets/temp-hazard2.png');
    this.load.image('hazardImage3', 'assets/temp-hazard3.png');
    this.load.spritesheet('cat', 'assets/spritesheet.png', {
        frameWidth: 120,
        frameHeight: 99
    });

}

function createStartScreen() {
    const {width, height} = this.scale;
 
    this.bg = this.add.tileSprite(0, 0, width * 1.2, height, 'background1').setScale(.9);

    this.bg.setOrigin(0, 0);

    // Display the starting screen
    var titleText = this.add.text(600, 135, 'Meowlympics', {
        fontSize: '120px',
        fill: '#fff',
        fontFamily: 'Mochiy Pop One, sans-serif'
    });
    titleText.setOrigin(0.5);
    
    startText = this.add.text(600, 260, 'Press Start', {
        fontSize: '38px',
        fill: '#fff',
        fontFamily: 'VT323, sans-serif'
    });
    startText.setOrigin(0.5);

    // Create a start button
    startButton = this.add.text(600, 315, 'Start', {
        fontSize: '26px',
        fill: '#fff',
        fontFamily: 'VT323, sans-serif',
        backgroundColor: '#4C8A46',
        padding: {
            x: 38,
            y: 5
        }
    });
    startButton.setOrigin(0.5);
    startButton.setInteractive({ useHandCursor: true });
    startButton.on('pointerdown', startGame, this);
}

function startGame() {
    this.timer = 0;
    this.gameRunning = true;

    // Remove the starting screen elements
    startButton.destroy();

    if (this.backgroundAudio) {
        this.backgroundAudio.stop();
    }

    // Play the background audio after a user gesture (button click)
    this.backgroundAudio = this.sound.add('backgroundAudio', { loop: true });
    this.backgroundAudio.play();

    // Set up the game scene
    this.gameSpeed = 15;

    this.time.addEvent({
        delay: hazardSpawnInterval,
        callback: spawnHazard,
        callbackScope: this,
        loop: true
    });

    this.timeText.setVisible(true);

    // Remove the start screen text
    this.children.list.forEach(function (child) {
        if (child instanceof Phaser.GameObjects.Text) {
            child.destroy();
        }
    });

    startText.destroy();
}

function create() {
    createStartScreen.call(this);

    ground = this.physics.add.staticGroup();
    ground.create(550, 590, 'ground');

    player = this.physics.add.sprite(100, 450, 'cat');
    player.setBounce(0);
    player.setCollideWorldBounds(true);

    this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('cat', { start: 0, end: 2 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'turn',
        frames: [{ key: 'cat', frame: 0 }],
        frameRate: 20
    });

    this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('cat', { start: 1, end: 2 }),
        frameRate: 10,
        repeat: -1
    });

    this.physics.add.collider(player, ground);

    hazards = this.physics.add.group();

    this.physics.add.collider(hazards, ground, function (hazard) {
        hazard.destroy(); // Destroy the hazard when it hits the ground
    });

   // Initialize highScore from local storage, or set it to 0 if not present
   this.highScore = localStorage.getItem('highScore') || 0;

   // Create and display the high score text on the top left
   this.highScoreText = this.add.text(40, 30, 'High Score: ' + Math.floor(this.highScore / 1000) + 's', {
       fontSize: '24px',
       fill: '#fff',
       fontFamily: 'VT323, sans-serif'
   }).setOrigin(0, 0);

   // Create and display the time text on the top right
   this.timeText = this.add.text(1120, 40, 'Time: 0s', {
    fontSize: '28px',
    fill: '#fff',
    fontFamily: 'VT323, sans-serif'
}).setOrigin(1, 0).setVisible(false);

    cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    if (cursors) {
        if (cursors.left.isDown) {
            player.setVelocityX(-500);
            player.anims.play('left', true);
        } else if (cursors.right.isDown) {
            player.setVelocityX(500);
            player.anims.play('right', true);
        } else {
            player.setVelocityX(0);
            player.anims.play('turn');
        }

        if (cursors.up.isDown && player.body.touching.down) {
            player.setVelocityY(-900);
        }
    }
    if (this.gameRunning) {
        this.timer += this.game.loop.delta;
        this.timeText.setText('Time: ' + Math.floor(this.timer / 1000) + 's');
    }

    this.bg.tilePositionX += 0.8;
}


function spawnHazard() {
    // Choose a random hazard image key
    var randomHazardKey = Phaser.Math.RND.pick(['hazardImage1', 'hazardImage2', 'hazardImage3']);

    // Create a hazard with the randomly chosen image key
    var hazard = hazards.create(1200, 520, randomHazardKey);
    hazard.setVelocityX(-hazardSpeed);
    hazard.setOrigin(0, 1);
    hazard.setDepth(1);
    hazard.setScale(1);

    this.physics.world.enable(hazard);
    hazard.body.allowGravity = false;

    this.physics.add.collider(player, hazard, () => {
        console.log('Player collided with hazard.');
        // Delay the execution of gameOver by a short time
        setTimeout(() => {
            gameOver.call(this);
        }, 10);
    });

    console.log('After setting up collision callback');

} 


function gameOver() {
    console.log('Game over function called.');
    this.gameRunning = false;

    // Stop physics
    this.physics.pause();

    // Display game over message
    var gameOverText = this.add.text(600, 260, 'Game Over', {
        fontSize: '64px',
        fill: '#fff',
        fontFamily: 'Mochiy Pop One, sans-serif'
    });
    gameOverText.setOrigin(0.5);

    // Display restart button
    var restartButton = this.add.text(600, 340, 'Restart', {
        fontSize: '24px',
        fill: '#fff',
        fontFamily: 'VT323, sans-serif',
        backgroundColor: '#4C8A46',
        padding: {
            x: 38,
            y: 5
        }
    });
    restartButton.setOrigin(0.5);
    restartButton.setInteractive({ useHandCursor: true });
    restartButton.on('pointerdown', function () {
        // Restart the scene
        this.scene.restart();
    }, this);

    // Update the high score if the current game time is higher than the stored high score
    if (this.timer > this.highScore) {
        this.highScore = this.timer;
        localStorage.setItem('highScore', this.highScore);
        this.highScoreText.setText('High Score: ' + Math.floor(this.highScore / 1000) + 's');
    }
}

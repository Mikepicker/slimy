var game = new Phaser.Game(768, 432, Phaser.AUTO, '',
  { preload: preload, create: create, update: update, render: render });

function preload()
{
  game.load.spritesheet('atlas', 'assets/atlas.png', 32, 32);
  game.load.spritesheet('slimy', 'assets/slimy.png', 32, 32);
  game.load.spritesheet('enemy', 'assets/enemy.png', 32, 32);
  game.load.spritesheet('clouds', 'assets/clouds.png', 32, 16);

  game.load.image('axe', 'assets/axe.png', 12, 20);
  game.load.image('ripple', 'assets/ripple.png', 32, 4);
  game.load.image('particle', 'assets/particle.png', 2, 2);

  game.load.image('title', 'assets/title.png', 64, 32);
  game.load.image('button_play', 'assets/button_play.png', 64, 32);

  game.load.audio('slimy_land', 'sounds/slimy_land.wav');
  game.load.audio('slimy_water', 'sounds/slimy_water.wav');
  game.load.audio('axe', 'sounds/axe.ogg');
  game.load.audio('enemy_die', 'sounds/enemy_die.wav');
  game.load.audio('ice', 'sounds/ice.wav');
}

// Constants
const MIN_WALL_HEIGHT = 2;
const MAX_WALL_HEIGHT = 4;
const MIN_WALL_WIDTH = 1;
const MAX_WALL_WIDTH = 4;

// Game Objects
var gameState;
var slimy, slimyGroup;
var enemies;
var walls, wallsTimer;
var wallsTime = 5;
var axes;
var ground, lastTile;
var cursors;
var jumpEnergy = 0;
var waterBitmap, waterTexture;
var ripples;
var levelSpeed = 40;
var levelSpeedTimer;
var icyTiles = 0;
var fadePanelBitmap, fadePanelSprite;
var gameOver = false;
var gameState = "state_menu"; // Menu, Game
var score = 0;

// Sounds
var slimyLandSound, slimyWaterSound, axeSound, enemyDieSound, iceSound;

// UI
var UIGroup;
var title, buttonPlay;
var creditsText;
var highScoreText, currentScore;
var tutorialText;

//------------------------PHASER CALLBACKS------------------------//
function create()
{
  // Init Physics System
  game.physics.startSystem(Phaser.Physics.ARCADE);
  game.physics.arcade.gravity.y = 200;

  // Screen Shake Plugin
  game.plugins.screenShake = game.plugins.add(Phaser.Plugin.ScreenShake);
  game.plugins.screenShake.setup({
   shakeX: true,
   shakeY: true
  });

  // Cursors
  cursors = game.input.keyboard.createCursorKeys();

  // Background
  game.stage.backgroundColor = '#f7e8b0';

  // Water Bitmap
  waterBitmap = game.add.bitmapData(game.width, 348);
  waterBitmap.addToWorld(0,348,0,1,1,-1);


  // Clouds
  clouds = game.add.group();
  clouds.enableBody = true;
  clouds.physicsBodyType = Phaser.Physics.ARCADE;
  clouds.createMultiple(10, 'clouds');
  clouds.setAll('anchor.x', 0.5);
  clouds.setAll('anchor.y', 0.5);
  clouds.setAll('body.allowGravity', false);
  generateCloud();

  // Init Walls Group
  walls = game.add.group();
  walls.enableBody = true;
  walls.physicsBodyType = Phaser.Physics.ARCADE;
  walls.createMultiple(128, 'atlas');
  walls.setAll('anchor.x', 0.5);
  walls.setAll('anchor.y', 0.5);
  walls.setAll('body.immovable', true);
  walls.setAll('body.allowGravity', false);
  walls.speed = levelSpeed;

  // Init Ground Group
  ground = game.add.group();
  ground.enableBody = true;
  ground.physicsBodyType = Phaser.Physics.ARCADE;
  ground.createMultiple(60, 'atlas');
  ground.setAll('anchor.x', 0.5);
  ground.setAll('anchor.y', 0.5);
  ground.setAll('body.immovable', true);
  ground.setAll('body.allowGravity', false);
  ground.speed = levelSpeed;

  // Init Enemies Group
  enemies = game.add.group();
  enemies.enableBody = true;
  enemies.physicsBodyType = Phaser.Physics.ARCADE;
  enemies.createMultiple(10, 'enemy');
  enemies.setAll('anchor.x', 0.5);
  enemies.setAll('anchor.y', 0.5);
  enemies.setAll('body.allowGravity', true);
  enemies.setAll('scale.x', -1);
  enemies.speed = 10;

  // Init Axes Group
  axes = game.add.group();
  axes.enableBody = true;
  axes.physicsBodyType = Phaser.Physics.ARCADE;
  axes.createMultiple(10, 'axe');
  axes.setAll('anchor.x', 0.5);
  axes.setAll('anchor.y', 0.5);
  axes.setAll('body.allowGravity', true);
  axes.speed = 400;
  axes.angularSpeed = 300;

  // Create Ground
  createGround();

  // Generate Walls
  generateWalls();
  wallsTimer = game.time.events.loop(Phaser.Timer.SECOND*wallsTime, generateWalls, this);

  // Slimy Group (Z ordering)
  slimyGroup = game.add.group();

  // Water Blue Texture
  waterTexture = game.add.bitmapData(game.width,game.height);
  waterTexture.addToWorld();
  waterTexture.ctx.beginPath();
  waterTexture.ctx.rect(0, 348, game.width, 100);
  waterTexture.ctx.fillStyle = '#7fc0d7';
  waterTexture.ctx.globalAlpha = 0.8;
  waterTexture.ctx.fill();

  // Water Ripples
  ripples = game.add.group();
  ripples.enableBody = true;
  ripples.physicsBodyType = Phaser.Physics.ARCADE;
  ripples.createMultiple(10, 'ripple');
  ripples.setAll('anchor.x', 0.5);
  ripples.setAll('anchor.y', 0.5);
  ripples.setAll('body.allowGravity', false);
  generateRipple();

  // Increase Difficulty
  levelSpeedTimer = game.time.events.loop(Phaser.Timer.SECOND*5, increaseLevelSpeed, this);

  // Throw
  game.input.onTap.add(function(pointer)
  {
    if (gameOver || gameState != 'state_game')
      return;

    slimy.throwing = false;
    slimy.animations.play('throw');
    slimy.animations.currentAnim.onComplete.add(function()
    {
      if (!slimy.throwing)
      {
        throwAxe(game.input.activePointer.x, game.input.activePointer.y);
        slimy.animations.play('idle');
        slimy.throwing = true;
      }
    }, this);

  }, this);

  // UI
  UIGroup = game.add.group();
  title = game.add.sprite(game.world.centerX-64, 64, 'title');
  buttonPlay = game.add.button(game.world.centerX-32, game.world.centerY-16, 'button_play', function()
    {
      gameState = 'state_game';
      createSlimy();
      title.kill();
      buttonPlay.kill();
      highScoreText.kill();
      showTutorial();

      currentScoreText = game.add.text(10, 0, 'Score: 0', { font: '30px Pixeltype', fill: '#639bff'});
      currentScoreText.setShadow(1, 1, '#ffffff', 1);
      UIGroup.add(currentScoreText);

    }, this);

  // Credits
  creditsText = game.add.text(game.width - 110, 0, '@Mikepicker',
    { font: '30px Pixeltype', fill: '#639bff' });
  creditsText.setShadow(1, 1, '#ffffff', 1);

  // High Score
  if(typeof(Storage) !== "undefined")
  {
    if (localStorage.highScore === undefined)
      localStorage.setItem('highScore', 0);

    highScoreText = game.add.text(10, 0, 'High Score: ' +
      localStorage.highScore, { font: '30px Pixeltype', fill: '#639bff'});
    highScoreText.setShadow(1, 1, '#ffffff', 1);
  }

  // Assign to UI Group
  UIGroup.add(title);
  UIGroup.add(buttonPlay);
  UIGroup.add(highScoreText);
  UIGroup.add(creditsText);

  // Set Fade Panel Bitmap
  fadePanelBitmap = game.add.bitmapData(game.width, game.height);
  fadePanelBitmap.ctx.beginPath();
  fadePanelBitmap.ctx.rect(0,0,game.width,game.height);
  fadePanelBitmap.ctx.fillStyle = 'black';
  fadePanelBitmap.ctx.fill();
  fadePanelSprite = game.add.sprite(0,0,fadePanelBitmap);
  fadePanelSprite.alpha = 0;

  // Sounds
  slimyLandSound = game.add.audio('slimy_land');
  slimyLandSound.volume = 0.3;
  slimyWaterSound = game.add.audio('slimy_water');
  slimyWaterSound.volume = 0.3;
  axeSound = game.add.audio('axe');
  enemyDieSound = game.add.audio('enemy_die');
  enemyDieSound.volume = 0.3;
  iceSound = game.add.audio('ice');
  iceSound.volume = 0.1;
}

function update()
{
  waterReflection();

  // Axe collision
  game.physics.arcade.collide(axes, ground, collisionAxeGround, null, this);
  game.physics.arcade.collide(axes, enemies, collisionAxeEnemy, null, this);

  game.physics.arcade.collide(enemies, walls);
  game.physics.arcade.collide(enemies, ground);

  // Ground
  game.physics.arcade.collide(ground, ground);

  // Slimy Logic
  game.physics.arcade.collide(slimy, ground, function(slimy, ground)
  {
    if (slimy.state === "state_fly")
    {
      slimyLandSound.play();

      slimy.body.velocity.set(0,0);
      slimy.angle = 0;
      slimy.animations.play('idle');
      slimy.state = "state_idle";
    }
  }, null, this);

  game.physics.arcade.collide(slimy, walls, function(slimy, wall)
  {
      // Kill if compressed!
      if (slimy.body.touching.left && slimy.body.touching.right)
      {
        gameOver = true;
        slimy.kill();
        explosion(slimy.position.x, slimy.position.y);
        reset();
        return;
      }

      if (slimy.state === "state_fly")
      {
        slimy.body.velocity.set(0,0);
        slimy.body.allowGravity = false;
        slimy.animations.play('idle');
        slimy.state = "state_idle";

        if (slimy.body.touching.right)
        {
          slimy.angle = -90;
          slimy.body.velocity.x = wall.body.velocity.x;
        }
        else if (slimy.body.touching.left)
        {
          slimy.angle = 90;
          slimy.body.velocity.x = wall.body.velocity.x;
        }
        else if (slimy.body.touching.down)
        {
          // Bonus on good landing
          if (-45 < slimy.angle && slimy.angle < 45)
            showScore(slimy.position.x, slimy.position.y, 10);

          slimy.angle = 0;
          slimy.body.velocity.x = wall.body.velocity.x;
        }
        else
          slimy.angle = 0;
      }
  }, null, this);

  recycleEntities();

  // Condition to Game Over
  if (gameOver || !slimy)
    return;

  if (slimy.position.x + slimy.width/2 < 0 ||
      slimy.position.x - slimy.width/2 > game.width)
  {
    gameOver = true;
    slimy.kill();
    reset();
    return;
  }

  // Water
  if (slimy.position.y + slimy.height/2 > 348)
  {
    slimyWaterSound.play();

    gameOver = true;
    reset();
    return;
  }

  if (game.physics.arcade.collide(slimy, enemies, null, null, this))
  {
      gameOver = true;
      explosion(slimy.position.x, slimy.position.y);
      slimy.kill();
      reset();
      return;
  }

  // Tap
  if (gameState === 'state_game' && game.input.activePointer.isDown)
  {
    if (slimy.state === "state_idle")
    {
      slimy.animations.play('charge');
      slimy.state = "state_charge"
    }
  }
  else // Release
  {
    if (slimy.state === "state_charge")
    {
      game.physics.arcade.moveToXY(slimy, game.input.activePointer.x,
        game.input.activePointer.y, jumpEnergy);
      jumpEnergy = 0;
      slimy.body.allowGravity = true;
      slimy.animations.play('idle');
      slimy.state = "state_fly";
    }
  }

  // Charge Jump
  if (slimy.state === "state_charge")
    jumpEnergy = slimy.speed;

  // On Fly
  if (slimy.state === "state_fly")
    slimy.angle += 2;
}

function render()
{
}
//------------------------CUSTOM ROUTINES------------------------//
function createSlimy()
{
  slimy = game.add.sprite(300,-32, 'slimy');
  slimyGroup.add(slimy);
  game.physics.arcade.enable(slimy);
  slimy.anchor.setTo(0.5, 0.5);
  slimy.animations.add('idle', [0], 2, true);
  slimy.animations.add('charge', [1], 2, true);
  slimy.animations.add('throw', [2], 10, false);
  slimy.animations.play('idle');
  slimy.speed = 300;
  slimy.angle = 140;
  slimy.body.allowGravity = true;
  slimy.state = "state_fly"  // States: idle, fly
  slimy.contactDir = "";
  slimy.throwing = false;
}

function generateWalls()
{
  var height = Math.floor((Math.random() * MAX_WALL_HEIGHT) + MIN_WALL_HEIGHT);
  var width = Math.floor((Math.random() * MAX_WALL_WIDTH) + MIN_WALL_WIDTH);
  var baseX = game.width + (4*32) + 16;
  var baseY = 300;
  var randSpeed = -((Math.random()*10)+levelSpeed-5);

  for (var i = 0; i < width; i++)
  {
    for (var j = 0; j < height; j++)
    {
      wall = walls.getFirstExists(false);
      if (wall)
      {
        wall.frame = (j == height-1) ? 1 : 2;

        wall.reset(baseX + (i*32), baseY - (j*32));
        wall.body.velocity.x = randSpeed;
      }
    }
  }

  // Generate enemy on top
  if (width > 1)
  {
    var minX = -16;
    var maxX = ((width-1) * 32) - 16;
    generateEnemy(baseX + (Math.random() * (maxX-minX)) + minX, baseY - (height*32) - 16);
  }
}

function createGround()
{
  var tiles = Math.floor(game.width/32) + 4;

  for (var i = 0; i < tiles; i++)
  {
    var tile = ground.getFirstExists(false);
    if (tile)
    {
      tile.frame = 1;
      tile.reset((i*32) + 16, 332);
      tile.body.velocity.x = -ground.speed;
    }

    lastTile = tile;
  };
}

function generateGround(offset)
{
  // Random Icy Tiles
  if (icyTiles === 0 && Math.random()*100 < 30)
    icyTiles = 4;

  var tile = ground.getFirstExists(false);
  if (tile)
  {
    if (icyTiles > 0)
    {
      tile.frame = 3;
      tile.body.immovable = false;
      icyTiles -= 1;
    }
    else
    {
      tile.frame = 1;
      tile.body.immovable = true;
    }

    tile.reset(offset + 31, 332);
    tile.body.velocity.x = -ground.speed;
  }

  lastTile = tile;
}

function generateRipple()
{
    var ripple = ripples.getFirstExists(false);
    if (ripple)
    {
      var randX = Math.random() * game.width;
      var randY = (Math.random() * 100) + 348;
      var randScale = (Math.random() * (1-0.9)) + 0.9;
      ripple.reset(randX, randY);
      ripple.body.velocity.x = 4;
      ripple.width *= randScale;
      ripple.height *= randScale;
      ripple.alpha = 0;
      var tween = game.add.tween(ripple).to( { alpha: 0.8 }, 500, "Linear", true, 0, 0);
      tween.yoyo(true, 500);
      tween.onComplete.add(function()
      {
        ripple.kill();
      }, this);
    }

    var minTime = Phaser.Timer.SECOND/4;
    var maxTime = Phaser.Timer.SECOND;
    game.time.events.add((Math.random() * (maxTime-minTime)) + minTime, generateRipple, this);
}

function generateCloud()
{
  var cloud = clouds.getFirstExists(false);
  if (cloud)
  {
    var randX = Math.random() * game.width;
    var randY = (Math.random() * (200-32)) + 32;
    var randScale = (Math.random() * (1-0.9)) + 0.9;
    cloud.reset(randX, randY);
    cloud.frame = Math.floor(Math.random()*2);
    cloud.body.velocity.x = 4;
    cloud.width *= randScale;
    cloud.height *= randScale;
    cloud.alpha = 0;
    var tween = game.add.tween(cloud).to( { alpha: 1 }, 500, "Linear", true, 0, 0);
    tween.yoyo(true, 10000);
    tween.onComplete.add(function()
    {
      cloud.kill();
    }, this);
  }

  var minTime = Phaser.Timer.SECOND/2;
  var maxTime = Phaser.Timer.SECOND;
  game.time.events.add((Math.random() * (maxTime-minTime)) + minTime, generateCloud, this);
}

function generateEnemy(posX, posY)
{
  enemy = enemies.getFirstExists(false);
  if (enemy)
  {
    enemy.hit = false;
    enemy.reset(posX, posY);
    enemy.animations.add('enemy', [0,1], 2, true);
    enemy.animations.play('enemy');
  }
}

function throwAxe(targetX, targetY)
{
  axeSound.play();

  axe = axes.getFirstExists(false);
  if (axe)
  {
    axe.reset(slimy.position.x, slimy.position.y, 332);
    axe.body.angularVelocity = axes.angularSpeed;
    game.physics.arcade.moveToXY(axe, targetX, targetY, axes.speed);
  }
}
//------------------------COLLISION CALLBACKS------------------------//
function collisionAxeGround(axe, ground)
{
  iceSound.play();

  if (ground.frame === 3)
    showScore(ground.position.x - 16, ground.position.y - 32, 5);

  explosion(axe.position.x, axe.position.y);
  axe.kill();
}

function collisionAxeEnemy(axe, enemy)
{
  enemyDieSound.play();

  showScore(enemy.position.x - 16, enemy.position.y - 32, 10);
  explosion(axe.position.x, axe.position.y);
  explosion(enemy.position.x, enemy.position.y);
  enemy.kill();
  axe.kill();
}
//------------------------UTILS------------------------//
function explosion(posX, posY)
{
  // Shake!
  game.plugins.screenShake.shake(10);

  var emitter = game.add.emitter(posX, posY, 100);
  emitter.makeParticles('particle');
  emitter.start(true, 2000, null, 10);
  game.time.events.add(4000, function()
  {
    emitter.kill();
  }, this);
}

function waterReflection()
{
  // Water Reflection
  waterBitmap.clear();

  if (slimy && slimy.alive)
    waterBitmap.draw(slimy, slimy.position.x, slimy.position.y);

  ground.forEachAlive(function(ground)
  {
    waterBitmap.draw(ground, ground.position.x, ground.position.y);
  });
  walls.forEachAlive(function(wall)
  {
    waterBitmap.draw(wall, wall.position.x, wall.position.y);
  });
  enemies.forEachAlive(function(enemy)
  {
    waterBitmap.draw(enemy, enemy.position.x, enemy.position.y);
  });
  axes.forEachAlive(function(axe)
  {
    waterBitmap.draw(axe, axe.position.x, axe.position.y);
  });
}

function increaseLevelSpeed()
{
  levelSpeed += 5;
}

function showTutorial()
{
  tutorialText = game.add.text(game.width/2 - 128, 128, 'Tap to jump, tap again to shoot',
    { font: '30px Pixeltype', fill: '#639bff' });

  var enter = game.add.tween(tutorialText).to( { alpha:1 }, 1000, "Linear");
  var exit = game.add.tween(tutorialText).to( { alpha:0 }, 1000, "Linear");
  enter.chain(exit);
  enter.start();
}

function showScore(posX, posY, score)
{
  this.score += score;

  currentScoreText.text = 'Score: ' + this.score;

  var scoreText = game.add.text(posX, posY, '+' + score,
    { font: '30px Pixeltype', fill: '#639bff' });
  scoreText.setShadow(1, 1, '#ffffff', 1);
  UIGroup.add(scoreText);

  var tween = game.add.tween(scoreText).to( { y:posY-32 }, 1000, "Linear");
  tween.start();
  tween.onComplete.add(function()
  {
    scoreText.kill();
  }, this);
}

function recycleEntities()
{
  // Kill out-of-bounds Entities
  walls.forEachAlive(function(wall)
  {
    if (wall.position.x + 32 < 0)
      wall.kill();
  });

  ground.forEachAlive(function(ground)
  {
    if (ground.position.x + 32 < 0)
    {
      generateGround(lastTile.position.x);
      ground.kill();
    }
  });

  axes.forEachAlive(function(axe)
  {
    if (axe.position.y - 32 > game.height)
      axe.kill();
  });

  enemies.forEachAlive(function(enemy)
  {
    if (enemy.position.x + 32 < 0 || enemy.position.y - 32 > game.height)
      enemy.kill();
  });
}
//------------------------GAME STATES------------------------//
function resetSlimy()
{
  if (!slimy.alive)
    slimy.revive();

  slimy.angle = 140;
  slimy.body.velocity.set(0,0);
  slimy.body.allowGravity = true;
  slimy.state = "state_fly";
  slimy.position.set(300,-32);
}

function resetGround()
{
  // Kill
  ground.forEach(function(ground)
  {
    ground.frame = 1;
    ground.body.immovable = true;
    ground.kill()
  }, this);

  icyTiles = 0;

  // Recreate
  var tiles = Math.floor(game.width/32) + 4;
  for (var i = 0; i < tiles; i++)
  {
    var tile = ground.getFirstExists(false);
    if (tile)
    {
      tile.frame = 1;
      tile.body.immovable = true;
      tile.reset((i*32) + 16, 332);
      tile.body.velocity.x = -ground.speed;
    }

    lastTile = tile;
  };
}

function resetWalls()
{
  // Kill
  walls.forEachAlive(function(wall)
  {
    wall.kill()
  }, this);

  // Reset Timer
  game.time.events.remove(wallsTimer);
  wallsTimer = game.time.events.loop(Phaser.Timer.SECOND*wallsTime, generateWalls, this);
}

function resetEnemies()
{
  // Kill
  enemies.forEachAlive(function(enemy)
  {
    enemy.kill()
  }, this);
}

function resetAxes()
{
  // Kill
  axes.forEachAlive(function(axe)
  {
    axe.kill()
  }, this);
}

function resetLevelSpeedTimer()
{
  game.time.events.remove(levelSpeedTimer);
  levelSpeedTimer = game.time.events.loop(Phaser.Timer.SECOND*5, increaseLevelSpeed, this);
}

function reset()
{
  // Save High Score
  if(typeof(Storage) !== "undefined")
  {
    if (score > localStorage.highScore)
      localStorage.highScore = score;
  }

  var fadeOut = game.add.tween(fadePanelSprite).to( { alpha: 1 }, 1000, "Linear");
  var fadeIn = game.add.tween(fadePanelSprite).to( { alpha: 0 }, 1000, "Linear");

  fadeOut.start();
  fadeOut.onComplete.add(function()
  {
    score = 0;
    currentScoreText.text = 'Score: ' + score;
    levelSpeed = 40;
    gameOver = false;
    resetLevelSpeedTimer();
    resetEnemies();
    resetGround();
    resetSlimy();
    resetWalls();
    resetAxes();
    fadeIn.start();
    showTutorial();
  }, this);
}

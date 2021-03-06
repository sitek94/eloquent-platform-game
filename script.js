/* 
A whole game consists of multiple levels that the player must complete. A level is completed when all coins have been collected. If the player touches lava, the current level is restored to its starting position, and the player may try again.
*/

let simpleLevelPlan = `
......................
..#................#..
..#..............=.#..
..#.........o.o....#..
..#.@......#####...#..
..#####............#..
......#++++++++++++#..
......##############..
......................`;
/* ==================================================================== */
/* ========================= READING A LEVEL ========================== */
/* ==================================================================== */
class Level {
  constructor(plan) {
    // Rows of the plan
    let rows = plan
      // Remove whitespace so that we can start with new line.
      .trim()
      .split('\n')
      // Spread each line into array array of characters
      .map(line => [...line]);

    this.height = rows.length;
    this.width = rows[0].length;

    // Actors - all moving elements
    this.startActors = [];

    // Background will be an array of arrays of strings
    this.rows = rows.map((row, y) => {

      // We're getting x- and y- coordinates from second argument of `map`
      return row.map((char, x) => {

        // Use `levelChars` object to interpret the character
        let type = levelChars[char];
        
        // If it's a string just return it
        if (typeof type === 'string') return type;

        // If type is an actor class, `create` method is used to create an object
        this.startActors.push(
          // The position of the actor is stored as `Vec` object
          type.create(new Vec(x, y), char)
        );

        // We replace actor with "empty" for the background square
        return 'empty';
      });
    });
  }
}

/* STATE - tracks the state of running game */
class State {
  constructor(level, actors, status) {
    this.level = level;
    this.actors = actors;

    // The `status` will switch to "lost" or "won" when game
    // has ended
    this.status = status;
  }

  static start(level) {
    return new State(level, level.startActors, "playing");
  }

  get player() {
    return this.actors.find(actor => actor.type === "player");
  }
}

/* ========================================================================= */
/* =============================== ACTORS ================================== */
/* ========================================================================= */

/* VEC - creates two-dimensional vector */
class Vec {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  plus(other) {
    return new Vec(this.x + other.x, this.y + other.y);
  }

  // Scales a vector by a given number. It will be useful when we need
  // to multiply a speed vector by a time interval to get the distance
  // during that time
  times(factor) {
    return new Vec(this.x * factor, this.y * factor);
  }
}

/* =============================== PLAYER ================================== */
class Player {
  constructor(pos, speed) {
    this.pos = pos;

    // `speed` is used to simulate momentum and gravity
    this.speed = speed;
  }

  get type() { return "player"; } 

  static create(pos) {
    return new Player(
      // pos: Because a player is one-and-a-half squares high, its initial
      // position is set to be half a square above the position where @
      // appeared   
      pos.plus(new Vec(0, -0.5)),
      // Initial speed i zero
      new Vec(0, 0)
    );
  }
}

// The `size` property is the same for all instances of `Player`,
// we store it on its prototype
Player.prototype.size = new Vec(0.8, 1.5);

/* =============================== LAVA ================================== */
class Lava {
  constructor(pos, speed, reset) {
    this.pos = pos;
    this.speed = speed;

    // Dynamic lava moves along at its current speed until it hits
    // an obstacle. If it has a reset property it will jump back
    // to its starting position (dripping). 
    // Otherwise, it will invert its speed and continue in the other
    // direction (bouncing).
    this.reset = reset;
  }

  get type() { return "lava"; }

  // Initialize the object differently depending on the character 
  // it is based on 
  static create(pos, char) {
    if (char === "=") return new Lava(pos, new Vec(2, 0));
    else if (char === "|") return new Lava(pos, new Vec(0, 2));
    else if (char === "v") return new Lava(pos, new Vec(0, 3), pos);
  }
}

Lava.prototype.size = new Vec(1, 1);

/* =============================== COIN ================================== */
class Coin {
  // To liven up the game a little, coins are given `wobble` property,
  // a slight vertical back-and-forth motion.
  constructor(pos, basePos, wobble) {
    this.pos = pos;
    
    // `basePos` and `wobble` determine the coin's actual position
    // that is stored in `pos` 
    this.basePos = basePos;
    // Tracks the phase of bouncing motion.
    this.wobble = wobble;
  }

  get type() { return "coin"; }

  static create(pos) {
    let basePos = pos.plus(new Vec(0.2, 0.1));

    return new Coin(
      basePos, 
      basePos, 
      // Math.sin gives us the y-coordinate of a point on a circle.
      // That coordinate goes back and forth in a smooth waveform as
      // we move along the circle, which makes the sine function useful
      // for modeling a wavy motion.

      // To avoid a situation where all coins move up and down 
      // synchronously, the starting phase of each coin is randomized. The 
      // phase of Math.sin’s wave, the width of a wave it produces, is 2π. 
      // We multiply the value returned by Math.random by that number to 
      // give the coin a random starting position on the wave.
      Math.random() * Math.PI * 2
    );
  }
}

Coin.prototype.size = new Vec(0.6, 0.6);

/* ================================= MONSTER =============================== */
const MONSTER_SPEED = 4;

class Monster {
  constructor(pos, speed) {
    this.pos = pos;
  }

  get type() {
    return 'monster';
  }

  static create(pos) {
    return new Monster(pos.plus(new Vec(0, -1)), new Vec(2, 0));
  }

  update(time, state) {
    let player = state.player;
    let speed = (player.pos.x < this.pos.x ? -1 : 1) * time * MONSTER_SPEED;
    let newPos = new Vec(this.pos.x + speed, this.pos.y);

    if (state.level.touches(newPos, this.size, 'wall')) {
      return this;
    } else {
      return new Monster(newPos);
    }
  }

  collide(state) {
    let player = state.player;
     
    if (player.pos.y + player.size.y < this.pos.y + .5) {
      let filtered = state.actors.filter(a => a !== this);
      return new State(state.level, filtered, state.status);
    } else {
      return new State(state.level, state.actors, 'lost');
    }
  }
}

Monster.prototype.size = new Vec(1.2, 2);

/* LEVEL CHARACTERS */
const levelChars = {
  // Empty space
  '.': 'empty',
  // Walls
  '#': 'wall',
  // Lava
  '+': 'lava',
  // Player's starting position
  '@': Player,
  // Coins
  'o': Coin,
  // Block of lava that moves back and forth horizontally
  '=': Lava,
  // Vertically moving blobs
  '|': Lava,
  // Dripping lava - vertically moving lava that doesn’t bounce back and forth but only
  // moves down, jumping back to its start position when it hits the floor.
  'v': Lava,
  'M': Monster,
};

/* ================================================================ */
/* ========================= DOM DISPLAY ========================== */
/* ================================================================ */

// A helper function that provides a succinct way to create an element
// and givi it some attributes and child nodes
function elt(name, attrs, ...children) {
  let dom = document.createElement(name);

  for (let attr of Object.keys(attrs)) {
    dom.setAttribute(attr, attrs[attr]);
  }

  for (let child of children) {
    dom.appendChild(child);
  }

  return dom;
}

// A display is created by giving it a parent element to which it should 
// append itself and a level object
class DOMDisplay {
  constructor(parent, level) {
    // The level's background grid, which never changes is drawn once.
    this.dom = elt("div", { class: "game" }, drawGrid(level));

    // Actors are redrawn every time the display is updated with a given
    // state and the `actorLayer` will be used to track the element that 
    // holds the actors so that they can be easily removed and replaced.
    this.actorLayer = null;
    
    parent.appendChild(this.dom);
  }
 
  clear() { this.dom.remove(); }
}

// Our coordinates and sizes are tracked in grid units, where a size or 
// distance of 1 means one grid block. When setting pixel sizes, we will 
// have to scale these coordinates up—everything in the game would be 
// ridiculously small at a single pixel per square. The scale constant gives 
// the number of pixels that a single unit takes up on the screen.
const SCALE = 20;

function drawGrid(level) {
  // Background is drawn as <table> element
  return elt(
    'table',
    {
      class: 'background',
      style: `width: ${level.width * SCALE}px`,
    },

    // `rows` property of the level are drawn as <tr>
    ...level.rows.map(row =>
      elt(
        'tr',
        { style: `height: ${SCALE}px` },

        // Each character of the row is drawn as <td> element
        // and its type is used as class name.
        ...row.map(type => 
          elt(
            'td', 
            { class: type }
          ))
      )
    )
  );
}

function drawActors(actors) {
  return elt(
    "div",
    {},
    ...actors.map(({ type, size, pos }) => {
       // Draw each actor by creating a DOM element
      let rect = elt("div", { class: `actor ${type}`});

      // Set element's position and size based on the actor's properties
      rect.style.width = `${size.x * SCALE}px`;
      rect.style.height = `${size.y * SCALE}px`;
      rect.style.left = `${pos.x * SCALE}px`;
      rect.style.top = `${pos.y * SCALE}px`;

      return rect;
    })
  );
}

// `syncState` method is used to make the display show a given state.
DOMDisplay.prototype.syncState = function(state) {

  // Remove the old actors graphics (if any)
  if (this.actorLayer) this.actorLayer.remove();

  // Redraw the acotrs in their new positions
  this.actorLayer = drawActors(state.actors);
  this.dom.appendChild(this.actorLayer);

  // By adding the level's current status as class name to the wrapper
  // we can style the player actor slighly differently when the game is
  // won or lost 
  this.dom.className = `game ${state.status}`;

  this.scrollPlayerIntoView(state);
}

// `scrollPlayerIntoView` method ensures that if the level is sticking out
// outside of the viewport, we scroll that viewport to make sure the player
// is near its center
DOMDisplay.prototype.scrollPlayerIntoView = function(state) {
  let width = this.dom.clientWidth;
  let height = this.dom.clientHeight;
  let margin = width / 3;

  // The viewport
  let left = this.dom.scrollLeft, right = left + width;
  let top = this.dom.scrollTop, bottom = top + height;

  let player = state.player;
  let center = player.pos
    // To find the actor's center, we add its position (its top left corner) 
    // and half its size. That is the center in level coordinates.
    .plus(player.size.times(0.5))
    // We need it in pixel coordinates, so we multiply it by scale
    .times(SCALE);

  // A series of checks verifies that the player position isn't outside,
  // of the allow range.
  if (center.x < left + margin) {
    this.dom.scrollLeft = center.x - margin;
  } else if (center.x > right - margin) {
    this.dom.scrollLeft = center.x + margin - width;
  }

  if (center.y < top + margin) {
    this.dom.scrollTop = center.y - margin;
  } else if (center.y > bottom - margin) {
    this.dom.scrollTop = center.y + margin - height;
  }

  // It would have been slightly simpler to always try to scroll the player 
  // to the center of the viewport. But this creates a rather jarring 
  // effect. As you are jumping, the view will constantly shift up and down. 
  // It is more pleasant to have a “neutral” area in the middle of the 
  // screen where you can move around without causing any scrolling.
};

/* =================================================================== */
/* ========================= CANVAS DISPLAY ========================== */
/* =================================================================== */

class CanvasDisplay {
  constructor(parent, level) {
    this.canvas = document.createElement('canvas');

    this.canvas.width = Math.min(600, level.width * SCALE);
    this.canvas.height = Math.min(450, level.height * SCALE);

    parent.appendChild(this.canvas);

    this.cx = this.canvas.getContext('2d');

    // Keep a flipPlayer property so that even when the player is standing still, 
    // it keeps facing the direction it last moved in.
    this.flipPlayer = false;

    // Rather than using the scroll position of its DOM element, it tracks its 
    // own viewport, which tells us what part of the level we are currently looking at.
    this.viewport = {
      left: 0,
      top: 0,
      width: this.canvas.width / SCALE,
      height: this.canvas.height / SCALE,
    }
  }

  clear() {
    this.canvas.remove();
  }
}

// Contrary to DOMDisplay, this display style does have to redraw the background 
// on every update. Because shapes on a canvas are just pixels, after we draw them 
// there is no good way to move them (or remove them).
CanvasDisplay.prototype.syncState = function(state) {
  this.updateViewport(state);
  this.clearDisplay(state.status);
  this.drawBackground(state.level);
  this.drawActors(state.actors);
}

// The updateViewport method is similar to DOMDisplay’s scrollPlayerIntoView method. 
// It checks whether the player is too close to the edge of the screen and moves
//  the viewport when this is the case.
CanvasDisplay.prototype.updateViewport = function(state) {
  let view = this.viewport, margin = view.width / 3;
  let player = state.player;
  let center = player.pos.plus(player.size.times(0.5));

  if (center.x < view.left + margin) {
    view.left = Math.max(center.x - margin, 0);
  } else if (center.x > view.left + view.width - margin) {
    view.left = Math.min(center.x + margin - view.width,
                         state.level.width - view.width);
  }

  if (center.y < view.top + margin) {
    view.top = Math.max(center.y - margin, 0);
  } else if (center.y > view.top + view.height - margin) {
    view.top = Math.min(center.y + margin - view.height,
                         state.level.height - view.height);
  }
};

// When clearing the display, we’ll use a slightly different color depending 
// on whether the game is won (brighter) or lost (darker).
CanvasDisplay.prototype.clearDisplay = function(status) {
  if (status === 'won') {
    this.cx.fillStyle = 'rgb(68, 191, 255)';
  } else if (status === 'lost') {
    this.cx.fillStyle = 'rgb(44, 136, 214)';
  } else {
    this.cx.fillStyle = 'rgb(52, 166, 251)';
  }
  this.cx.fillRect(0, 0, 
                   this.canvas.width, this.canvas.height);
}

/* ========================= OTHER SPRITES ========================== */
// It contains, the wall tile, the lava tile, and the sprite for a coin.
let otherSprites = document.createElement('img');
otherSprites.src = 'img/sprites.png';

// To draw the background, we run through the tiles that are visible in the current viewport.
CanvasDisplay.prototype.drawBackground = function(level) {
  let { left, top, width, height } = this.viewport;

  let xStart = Math.floor(left);
  let xEnd = Math.ceil(left + width);
  let yStart = Math.floor(top);
  let yEnd = Math.ceil(top + height);

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      let tile = level.rows[y][x];

      if (tile === 'empty') continue;

      let screenX = (x - left) * SCALE;
      let screenY = (y - top) * SCALE;

      let tileX = tile === 'lava' ? SCALE : 0;

      // Tiles that are not empty are drawn with drawImage.
      this.cx.drawImage(otherSprites,
                        tileX,         0, SCALE, SCALE,
                        screenX, screenY, SCALE, SCALE);
    }
  }
};

/* ========================= PLAYER SPRITES ========================== */
let playerSprites = document.createElement('img');
playerSprites.src = 'img/player.png';

// Because the sprites are slightly wider than the player object—24 instead of 16 pixels
// to allow some space for feet and arms—the method has to adjust the x-coordinate and width 
// by a given amount (PLAYER_X_OVERLAP).
const PLAYER_X_OVERLAP = 4;

CanvasDisplay.prototype.drawPlayer = function(player, x, y, width, height) {
  width += PLAYER_X_OVERLAP * 2;
  x -= PLAYER_X_OVERLAP;

  if (player.speed.x !== 0) {
    this.flipPlayer = player.speed.x < 0;
  }

  let tile = 8;
  if (player.speed.y !== 0) {
    tile = 9;
  } else if (player.speed.x !== 0) {
    tile = Math.floor(Date.now() / 60) % 8;
  }

  this.cx.save();
  if (this.flipPlayer) {
    flipHorizontally(this.cx, x + width / 2);
  }

  let tileX = tile * width;
  this.cx.drawImage(playerSprites, tileX, 0, width, height,
                                   x,     y, width, height);
  this.cx.restore();
}

function flipHorizontally(context, around) {
  context.translate(around, 0);
  context.scale(-1, 1);
  context.translate(-around, 0);
}

CanvasDisplay.prototype.drawActors = function(actors) {
  for (let actor of actors) {
    let width = actor.size.x * SCALE;
    let height = actor.size.y * SCALE;
    let x = (actor.pos.x - this.viewport.left) * SCALE;
    let y = (actor.pos.y - this.viewport.top) * SCALE;

    if (actor.type === 'player') {
      this.drawPlayer(actor, x, y, width, height);
    } else {
      let tileX = (actor.type === 'coin' ? 2 : 1) * SCALE;

      this.cx.drawImage(otherSprites,
                        tileX, 0, width, height,
                        x,     y, width, height);
    }
  }
}


/* ========================================================================= */
/* ========================= MOTION AND COLLISION ========================== */
/* ========================================================================= */

// This method tells us whether a rectangle (specified by a position and a size) 
// touches a grid element of the given type.
Level.prototype.touches = function(pos, size, type) {
  var xStart = Math.floor(pos.x);
  var yStart = Math.floor(pos.y)
  
  var xEnd = Math.ceil(pos.x + size.x);
  var yEnd = Math.ceil(pos.y + size.y);

  for (var y = yStart; y < yEnd; y++) {
    for (var x = xStart; x < xEnd; x++) {
      let isOutside = x < 0 || x >= this.width ||
                      y < 0 || y >= this.height;

      let here = isOutside ? 'wall' : this.rows[y][x];

      if (here === type) return true;
    }
  }
  return false;
}

/**
 * The state update method uses touches to figure out whether the player is touching lava.
 * 
 * @param {Number} time a time step 
 * @param {Array} keys a data structure that tells it which keys are being held down
 * 
 */
State.prototype.update = function(time, keys) {

  // Call the update method on all actors, producing an array of updated actors.
  let actors = this.actors
    // The actors also get the time step, the keys, and the state, 
    // so that they can base their update on those. 

    // Only the player will actually read keys, since that’s 
    // the only actor that’s controlled by the keyboard.
    .map(actor => actor.update(time, this, keys));

  let newState = new State(this.level, actors, this.status);

  // If the game is already over, no further processing has to be done.
  if (newState.status !== 'playing') return newState;

  let player = newState.player;

  // Test whether the player is touching background lava. 
  if (this.level.touches(player.pos, player.size, 'lava')) {
    return new State(this.level, actors, 'lost');
  }

  // Finally, if the game really is still going on, 
  // it sees whether any other actors overlap the player.
  for (let actor of actors) {
    if (actor !== player && overlap(actor, player)) {

      // If any actor does overlap, its collide method gets a chance to update the state. 
      newState = actor.collide(newState);
    }
  }

  return newState;
}

// Overlap between actors is detected with the overlap function. 
function overlap(actor1, actor2) {
  // Actors are overlapping when they overlap both along the x-axis and y-axis.
  return actor1.pos.x + actor1.size.x > actor2.pos.x &&
         actor1.pos.x < actor2.pos.x + actor2.size.x &&
         actor1.pos.y + actor1.size.y > actor2.pos.y &&
         actor1.pos.y < actor2.pos.y + actor2.size.y;
}

// Touching a lava actor sets the game status to "lost".
Lava.prototype.collide = function(state) {
  return new State(state.level, state.actors, 'lost');
}

Coin.prototype.collide = function(state) {

  //  Coins vanish when you touch them
  let filtered = state.actors.filter(a => a !== this);

  let status = state.status;

  // Set the status to "won" when they are the last coin of the level.
  if (!filtered.some(a => a.type === 'coin')) status = 'won';

  return new State(state.level, filtered, status);
}

/* ================================================================== */
/* ========================= ACTOR UPDATES ========================== */
/* ================================================================== */

// Lava update
Lava.prototype.update = function(time, state) {

  // Compute a new position by adding the product of the time step and the current speed 
  // to its old position. 
  let newPost = this.pos.plus(this.speed.times(time)); 

  // If no obstacle blocks that new position, it moves there.  
  if (!state.level.touches(newPost, this.size, 'wall')) {
    return new Lava(newPost, this.speed, this.reset);

    // If there is an obstacle, the behavior depends on the type of the lava block
    // — dripping lava has a reset position, to which it jumps back when it hits something.
  } else if (this.reset) {
    return new Lava(this.reset, this.speed, this.reset);

    // Bouncing lava inverts its speed by multiplying it by -1 
    // so that it starts moving in the opposite direction.
  } else {
    return new Lava(this.pos, this.speed.times(-1));
  }
};

const WOBBLE_SPEED = 8, WOBBLE_DIST = 0.07;

// Coin update
Coin.prototype.update = function(time) {

  // Coins use their update method to wobble. They ignore collisions with 
  // the grid since they are simply wobbling around inside of their own square.

  // The wobble property is incremented to track time and then is used as an 
  // argument to Math.sin to find the new position on the wave.
  let wobble = this.wobble + time * WOBBLE_SPEED;
  let wobblePos = Math.sin(wobble) * WOBBLE_DIST;

  //  The coin’s current position is then computed from its base 
  // position and an offset based on this wave.
  return new Coin(this.basePos.plus(new Vec(0, wobblePos)),
                  this.basePos, wobble);
};

const PLAYER_X_SPEED = 7;
const GRAVITY = 30;
const JUMP_SPEED = 17;

// Player update
Player.prototype.update = function(time, state, keys) {

  // x-axis
  let xSpeed = 0;

  // The horizontal motion is computed based on the state 
  // of the left and right arrow keys. 
  if (keys.ArrowLeft) xSpeed -= PLAYER_X_SPEED;
  if (keys.ArrowRight) xSpeed += PLAYER_X_SPEED;

  let pos = this.pos;

  let movedX = pos.plus(new Vec(xSpeed * time, 0));

  // When there’s no wall blocking the new position created by 
  // this motion, it is used. Otherwise, the old position is kept.
  if (!state.level.touches(movedX, this.size, 'wall')) {
    pos = movedX;
  }

  // y-axis
  // Vertical motion works in a similar way but has to simulate jumping and gravity.

  // The player’s vertical speed (ySpeed) is first accelerated to account for gravity.
  let ySpeed = this.speed.y + time * GRAVITY;

  let movedY = pos.plus(new Vec(0, ySpeed * time));

  // Check for walls
  if (!state.level.touches(movedY, this.size, 'wall')) {
    pos = movedY;

    // When the up arrow is pressed and we are moving down (meaning the thing 
    // we hit is below us), the speed is set to a relatively large, negative value.
  } else if (keys.ArrowUp && ySpeed > 0) {
    ySpeed = -JUMP_SPEED;

    // If that is not the case, the player simply bumped into 
    // something, and the speed is set to zero.
  } else {
    ySpeed = 0;
  }

  return new Player(pos, new Vec(xSpeed, ySpeed));
};

/* ================================================================== */
/* ========================= TRACKING KEYS ========================== */
/* ================================================================== */

function trackKeys(keys) {
  let down = Object.create(null);

  // The same handler function is used for both event types. 
  function track(event) {
    // It looks at the event object’s type property to determine whether 
    // the key state should be updated to true ("keydown") or false ("keyup").
    if (keys.includes(event.key)) {
      down[event.key] = event.type === 'keydown';

      event.preventDefault();
    }
  }

  window.addEventListener('keydown', track);
  window.addEventListener('keyup', track);

  down.unregister = () => {
    window.removeEventListener('keydown', track);
    window.removeEventListener('keyup', track);
  }

  return down;
}

/* ===================================================================== */
/* ========================= RUNNING THE GAME ========================== */
/* ===================================================================== */

function runAnimation(frameFunc) {
  let lastTime = null;

  function frame(time) {
    if (lastTime != null) {
      let timeStep = Math.min(time - lastTime, 100) / 1000;
      
      if (frameFunc(timeStep) === false) return;
    }
    lastTime = time;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function runLevel(level, Display) {
  let display = new Display(document.body, level);
  let state = State.start(level);
  let ending = 1;
  let running = 'yes';

  return new Promise(resolve => {
    function escHandler(event) {
      if (event.key !== 'Escape') return;

      event.preventDefault();

      if (running === 'no') {
        running = 'yes';
        runAnimation(frame);
      } else if (running === 'yes') {
        running = 'pausing';
      } else {
        running = 'yes';
      }
    }

    window.addEventListener('keydown', escHandler);
    let arrowKeys = trackKeys(['ArrowLeft', 'ArrowRight', 'ArrowUp']);

    function frame(time) {
      if (running == 'pausing') {
        running = 'no'
        return false;
      }

      state = state.update(time, arrowKeys);
      display.syncState(state);

      if (state.status === 'playing') {
        return true; 
      } else if (ending > 0) {
        ending -= time;
        return true;
      } else {
        display.clear();
        
        window.removeEventListener('keydown', escHandler);

        arrowKeys.unregister();
        resolve(state.status);
        return false;
      }
    }
    runAnimation(frame);
  });
}

const START_LIVES = 3;

async function runGame(plans, Display) {
  let lives = START_LIVES;

  for (let level = 0; level < plans.length;) {
    console.log(`Level: ${level + 1}, Lives: ${lives}`);
    let status = await runLevel(new Level(plans[level]), Display);

    if (status === 'won') level++;
    else lives--;

    if (lives > 0) {
      console.log(`You've won!`);
    } else {
      console.log('Game over');
    }
  }
}

runGame(GAME_LEVELS, CanvasDisplay);

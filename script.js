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

/* ========================= READING A LEVEL ========================== */
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


/* ========================= ACTORS ========================== */

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

/* PLAYER */
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

/* LAVA */
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

/* COIN */
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
  o: Coin,
  // Block of lava that moves back and forth horizontally
  '=': Lava,
  // Vertically moving blobs
  '|': Lava,
  // Dripping lava - vertically moving lava that doesn’t bounce back and forth but only
  // moves down, jumping back to its start position when it hits the floor.
  v: Lava,
};

/* ========================= DRAWING ========================== */

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

let simpleLevel = new Level(simpleLevelPlan);
let display = new DOMDisplay(document.body, simpleLevel);
display.syncState(State.start(simpleLevel));
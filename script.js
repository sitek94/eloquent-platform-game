let Player, Coin, Lava;

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

/* 
A whole game consists of multiple levels that the player must complete. A level is completed when all coins have been collected. If the player touches lava, the current level is restored to its starting position, and the player may try again.
*/

/* READING A LEVEL */
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
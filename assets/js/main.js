//координаты
function Coordinates(x, y) {
    this.x = x;
    this.y = y;
}
Coordinates.prototype.plus = function(other) {
    return new Coordinates(this.x + other.x, this.y + other.y);
};
//сетка мира
function Grid(width, height) {
    this.space = new Array(width * height);
    this.width = width;
    this.height = height;
}
Grid.prototype.isInside = function(coordinates) {
    return coordinates.x >= 0 && coordinates.x < this.width &&
        coordinates.y >= 0 && coordinates.y < this.height;
};
Grid.prototype.get = function(coordinates) {
    return this.space[coordinates.x + this.width * coordinates.y];
};
Grid.prototype.set = function(coordinates, value) {
    this.space[coordinates.x + this.width * coordinates.y] = value;
};
//направления
var directions = {
    "n":  new Coordinates( 0, -1),
    "ne": new Coordinates( 1, -1),
    "e":  new Coordinates( 1,  0),
    "se": new Coordinates( 1,  1),
    "s":  new Coordinates( 0,  1),
    "sw": new Coordinates(-1,  1),
    "w":  new Coordinates(-1,  0),
    "nw": new Coordinates(-1, -1)
};

var directionNames = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function Bounce() {
    this.direction = randomElement(directionNames);
}
//отскакиваем в случайное пустое место, если во что-то упираемся
Bounce.prototype.act = function(view) {
    if (view.look(this.direction) != " ") {
        this.direction = view.find(" ");
    }
    return {type: "move", direction: this.direction};
};
//определяем, что роль у обьекта в пищевой цепи, если это не пробел
function elementFromChar(role, ch) {
    if (ch == " ") {
        return null;
    }
    var element = new role[ch]();
    element.originChar = ch;
    return element;
}
//определяем место обьекта в мире
function World(map, role) {
    var grid = new Grid(map[0].length, map.length);
    this.grid = grid;
    this.role = role;

    map.forEach(function(line, y) {
        for (var x = 0; x < line.length; x++) {
            grid.set(new Coordinates(x, y), elementFromChar(role, line[x]));
        }
    });
}
//ф-ция, обратная elementFromChar
function charFromElement(element) {
    if (element == null) {
        return " ";
    } else {
        return element.originChar;
    }
}

World.prototype.toString = function() {
    var output = "";
    for (var y = 0; y < this.grid.height; y++) {
        for (var x = 0; x < this.grid.width; x++) {
            var element = this.grid.get(new Coordinates(x, y));
            output += charFromElement(element);
        }
        output += "\n";
    }
    return output;
};
//стена, не движется, выполняет роль препятствия
function Wall() {}
//обращение к каждому
Grid.prototype.forEach = function(f, context) {
    for (var y = 0; y < this.height; y++) {
        for (var x = 0; x < this.width; x++) {
            var value = this.space[x + y * this.width];
            if (value != null) {
                f.call(context, value, new Coordinates(x, y));
            }
        }
    }
};
//очередь
World.prototype.turn = function() {
    var acted = [];
    this.grid.forEach(function(being, coordinates) {
        if (being.act && acted.indexOf(being) == -1) {
            acted.push(being);
            this.letAct(being, coordinates);
        }
    }, this);
};
//движение и игнор других действий
World.prototype.letAct = function(being, coordinates) {
    var action = being.act(new View(this, coordinates));
    if (action && action.type == "move") {
        var dest = this.checkDestination(action, coordinates);
        if (dest && this.grid.get(dest) == null) {
            this.grid.set(coordinates, null);
            this.grid.set(dest, being);
        }
    }
};
//проверить клетку перед ходом
World.prototype.checkDestination = function(action, coordinates) {
    if (directions.hasOwnProperty(action.direction)) {
        var dest = coordinates.plus(directions[action.direction]);
        if (this.grid.isInside(dest))
            return dest;
    }
};

function View(world, coordinates) {
    this.world = world;
    this.coordinates = coordinates;
}
View.prototype.look = function(dir) {
    var target = this.coordinates.plus(directions[dir]);
    if (this.world.grid.isInside(target)) {
        return charFromElement(this.world.grid.get(target));
    } else {
        return "#";
    }
};
View.prototype.findAll = function(ch) {
    var found = [];
    for (var dir in directions)
        if (this.look(dir) == ch) {
            found.push(dir);
        }
    return found;
};
View.prototype.find = function(ch) {
    var found = this.findAll(ch);
    if (found.length == 0) {
        return null;
    }
    return randomElement(found);
};

function AliveWorld(map, role) {
    World.call(this, map, role);
}
AliveWorld.prototype = Object.create(World.prototype);

var actionTypes = Object.create(null);

AliveWorld.prototype.letAct = function(being, coordinates) {
    var action = being.act(new View(this, coordinates));
    var handled = action &&
        action.type in actionTypes &&
        actionTypes[action.type].call(this, being, coordinates, action);
    if (!handled) {
        being.energy -= 0.5; //существо, которое по какой-то причине не сделало ход теряет пол очка энергии
        if (being.energy <= 0) {
            this.grid.set(coordinates, null);
        }
    }
};

actionTypes.grow = function(being) {
    being.energy += 0.75; //скорость роста травы
    return true;
};
actionTypes.move = function(being, coordinates, action) {
    var dest = this.checkDestination(action, coordinates);
    if (dest == null || being.energy <= 1 || this.grid.get(dest) != null) {
        return false;
    }
    being.energy -= 1; //если ход успешен - -1 ед. энергии
    this.grid.set(coordinates, null);
    this.grid.set(dest, being);
    return true;
};
actionTypes.eat = function(being, coordinates, action) {
    var dest = this.checkDestination(action, coordinates);
    var atDest = dest != null && this.grid.get(dest);
    if (!atDest || atDest.energy == null)
        return false;
    being.energy += atDest.energy;
    this.grid.set(dest, null);
    return true;
};
actionTypes.reproduce = function(being, coordinates, action) {
    var baby = elementFromChar(this.role,
        being.originChar);
    var dest = this.checkDestination(action, coordinates);
    //если энергии меньше, чем у 2 новорожденных, или некуда родить - продолжать жизнь
    if (dest == null ||
        being.energy <= 2 * baby.energy ||
        this.grid.get(dest) != null)
        return false;
    //если больше - размножиться, разделив энергию с потомком пополам
    baby.energy = being.energy/2;
    being.energy = being.energy/2;
    this.grid.set(dest, baby);
    return true;
};

function Plant() {
    this.energy = 3 + Math.random() * 4;
}
Plant.prototype.act = function(view) {
    if (this.energy > 15) {
        var space = view.find(" ");
        if (space)
            return {type: "reproduce", direction: space};
    }
    if (this.energy < 20)
        return {type: "grow"};
};

function Herbivore() {
    this.energy = 20;
}
Herbivore.prototype.act = function(view) {
    var space = view.find(" ");
    if (this.energy > 40 && space)
        return {type: "reproduce", direction: space};
    var plant = view.find("*");
    if (plant)
        return {type: "eat", direction: plant};
    if (space)
        return {type: "move", direction: space};
};

function Predator() {
    this.energy = 30;
}
Predator.prototype.act = function(view) {
    var space = view.find(" ");
    var plantEater = view.find("o");

    if (this.energy > 60 && space )
        return {type: "reproduce", direction: space };

    if (plantEater)
        return {type: "eat", direction: plantEater};
    if (space)
        return {type: "move", direction: space};
};

var valley = new AliveWorld(
    [   "################################",
        "#o           #     ****        #",
        "#****        #         @    ***#",
        "#*   ***     #        **    ***#",
        "#   *****    ###########* o  **#",
        "#    ***     o        ****    *#",
        "#       o            ******    #",
        "#              @      ****     #",
        "#                              #",
        "#                              #",
        "#   o #######*        o        #",
        "#*          #**           o    #",
        "#***  @     #***    o        **#",
        "#*****      #****           ***#",
        "################################"],

    {"#": Wall,
     "@": Predator,
     "o": Herbivore,
     "*": Plant}
);
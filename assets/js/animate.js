function Animated(world) {
  this.world = world;

  var div = document.body.appendChild(document.createElement("div"));
      div.classList.add("container");

  this.pre = div.appendChild(document.createElement("pre"));
  this.pre.appendChild(document.createTextNode(world.toString()));

  var self = this;

  this.interval = setInterval(function() { self.tick(); }, 500);
}

Animated.prototype.tick = function() {
  this.world.turn();
  this.pre.removeChild(this.pre.firstChild);
  this.pre.appendChild(this.pre.ownerDocument.createTextNode(this.world.toString()));
};
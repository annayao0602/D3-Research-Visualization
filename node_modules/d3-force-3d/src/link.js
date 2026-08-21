import constant from "./constant.js";
import jiggle from "./jiggle.js";

function index(d) {
  return d.index;
}

function find(nodeById, nodeId) {
  var node = nodeById.get(nodeId);
  if (!node) throw new Error("node not found: " + nodeId);
  return node;
}

export default function(links) {
  var id = index,
      strength = defaultStrength,
      strengths,
      bias = defaultBias,
      biases,
      distance = constant(30),
      exponent = 1,
      distances,
      nodes,
      nDim,
      count,
      random,
      iterations = 1;

  if (links == null) links = [];

  function defaultStrength(link) {
    return 1 / Math.min(count[link.source.index], count[link.target.index]);
  }

  function defaultBias(link) {
    // bias[i] = count[link.source.index] / (count[link.source.index] + count[link.target.index])
    return count[link.source.index] / (count[link.source.index] + count[link.target.index]);
  }


  function force(alpha) {
    for (var k = 0, n = links.length; k < iterations; ++k) {
      for (var i = 0, link, source, target, x = 0, y = 0, z = 0, l, b; i < n; ++i) {
        link = links[i], source = link.source, target = link.target;
        x = target.x + target.vx - source.x - source.vx || jiggle(random);
        
        if (nDim > 1) { y = target.y + target.vy - source.y - source.vy || jiggle(random); }
        if (nDim > 2) { z = target.z + target.vz - source.z - source.vz || jiggle(random); }
        l = Math.sqrt(x * x + y * y + z * z);
        
        let lexp = (l - distances[i]);
        if(exponent == 1){
          // nothing...
        }if(exponent == 2){
          lexp = lexp * Math.abs(lexp);
        }else{
          lexp = lexp = Math.sign(lexp) * Math.pow(Math.abs(lexp), exponent);
        }
        l =  lexp / l * alpha * strengths[i];
        x *= l, y *= l, z *= l;

        target.vx -= x * (b = biases[i]);
        if (nDim > 1) { target.vy -= y * b; }
        if (nDim > 2) { target.vz -= z * b; }

        source.vx += x * (b = 1 - b);
        if (nDim > 1) { source.vy += y * b; }
        if (nDim > 2) { source.vz += z * b; }
      }
    }
  }

  function initialize() {
    if (!nodes) return;

    var i,
        n = nodes.length,
        m = links.length,
        nodeById = new Map(nodes.map((d, i) => [id(d, i, nodes), d])),
        link;

    for (i = 0, count = new Array(n); i < m; ++i) {
      link = links[i], link.index = i;
      if (typeof link.source !== "object") link.source = find(nodeById, link.source);
      if (typeof link.target !== "object") link.target = find(nodeById, link.target);
      count[link.source.index] = (count[link.source.index] || 0) + 1;
      count[link.target.index] = (count[link.target.index] || 0) + 1;
    }

    for (i = 0; i < m; ++i) {
      link = links[i];
    }

    strengths = new Array(m), initializeStrength();
    distances = new Array(m), initializeDistance();
    biases = new Array(m), initializeBias();
  }

  function initializeStrength() {
    if (!nodes) return;

    for (var i = 0, n = links.length; i < n; ++i) {
      strengths[i] = +strength(links[i], i, links);
    }
  }
  
  function initializeBias() {
    if (!nodes) return;
    for (var i = 0, n = links.length; i < n; ++i) {
      biases[i] = +bias(links[i], i, links);
    }
  }

  function initializeDistance() {
    if (!nodes) return;

    for (var i = 0, n = links.length; i < n; ++i) {
      distances[i] = +distance(links[i], i, links);
    }
  }

  force.initialize = function(_nodes, ...args) {
    nodes = _nodes;
    random = args.find(arg => typeof arg === 'function') || Math.random;
    nDim = args.find(arg => [1, 2, 3].includes(arg)) || 2;
    initialize();
  };

  force.links = function(_) {
    return arguments.length ? (links = _, initialize(), force) : links;
  };

  force.id = function(_) {
    return arguments.length ? (id = _, force) : id;
  };

  force.iterations = function(_) {
    return arguments.length ? (iterations = +_, force) : iterations;
  };

  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), initializeStrength(), force) : strength;
  };

  force.bias = function(_) {
    return arguments.length ? (bias = typeof _ === "function" ? _ : constant(+_), initializeBias(), force) : bias;
  };

  force.exponent = function(_) {
    return arguments.length ? (exponent = +_, force) : exponent;
  };

  force.distance = function(_) {
    return arguments.length ? (distance = typeof _ === "function" ? _ : constant(+_), initializeDistance(), force) : distance;
  };

  return force;
}

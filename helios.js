
import { gmlData } from "./uva_data.js";
import {Helios} from "https://cdn.skypack.dev/helios-web?min";
import { scaleOrdinal } from "https://cdn.skypack.dev/d3-scale?min";
import { select as d3Select } from "https://cdn.skypack.dev/d3-selection?min";
import { schemeCategory10 } from "https://cdn.skypack.dev/d3-scale-chromatic?min";
import { schemeTableau10 } from "https://cdn.skypack.dev/d3-scale-chromatic?min";



//---HELPER METHODS---
function GMLParse(gml) {
	var json = ('{\n' + gml + '\n}')
		.replace(/^(\s*)(\w+)\s*\[/gm, '$1"$2": {')
		.replace(/^(\s*)\]/gm, '$1},')
		.replace(/^(\s*)(\w+)\s+(.+)$/gm, '$1"$2": $3,')
		.replace(/,(\s*)\}/g, '$1}');

	var graph = {};
	var nodes = [];
	var edges = [];

	var i = 0;
	var parsed;
    
	json = json.replace(/^(\s*)"node"/gm, function (all, indent) {
		return (indent + '"node[' + (i++) + ']"');
	});
	i = 0;
	json = json.replace(/^(\s*)"edge"/gm, function (all, indent) {
		return (indent + '"edge[' + (i++) + ']"');
	});
	//replace NaN with null
	json = json.replace(/: NaN/g, ': null');
	
	try {
		parsed = JSON.parse(json);
	}
	catch (err) {
		throw new SyntaxError('bad format');
	}
	if (!isObject(parsed.graph)) {
		throw new SyntaxError('no graph tag');
	}
	forIn(parsed.graph, function (key, value) {
		var matches = key.match(/^(\w+)\[(\d+)\]$/);
		var name;
		var i;
		if (matches) {
			name = matches[1];
			i = parseInt(matches[2], 10);
			if (name === 'node') {
				nodes[i] = value;
			}
			else if (name === 'edge') {
				edges[i] = value;
			}
			else {
				graph[key] = value;
			}
		}
		else {
			graph[key] = value;
		}
	});
	
	let nodesDictionary = {};
	nodes.forEach(function (node) {
		nodesDictionary[node.id] = node;
	});
	graph.nodes = nodes;
	graph.edges = edges;
	return graph;
};

function isObject(value) {
	return (value && Object.prototype.toString.call(value) === '[object Object]');
}
function forIn(object, callback) {
	Object.keys(object).forEach(function (key) {
		callback(key, object[key]);
	});
}
function attribute(key, value) {
	if (typeof value === 'boolean') {
		value = Number(value);
	}
	else {
		value = JSON.stringify(value);
	}
	return (key + ' ' + value);
}
function loadGML(networkData) {
	return GMLParse(networkData);
}
async function loadGMLFile(networkFile) {
	let networkData = await fetch(networkFile)
		.then(response => {
			return response.text();
		});
	return loadGML(networkData);
}


//----CREATING VIZ----


const parsed = GMLParse(gmlData);

const helios = new Helios({
	elementID: 'netviz', 
	nodes: parsed.nodes, 	
	tracking: true,	
	edges: parsed.edges, 
	colorProperty: "0",
	use2D: false });

//----ADDING NEW FEATURES----
/*
Features to add:
- search bar for authors 
- legend for research fields
- hover effect to show label (author)
- ego network (search person, see who they are connected to)
*/

const colorDomains = [...new Set(Object.values(parsed.nodes).map(node => node[0]))];
console.log(colorDomains);
const colorScale = scaleOrdinal(schemeTableau10).domain(colorDomains);
console.log(colorScale);

//(node => colorScale(node[0]));


helios.onNodeHoverStart((node) => {
            if (node) {
                // Make the node bigger on hover
                node.size *= 1.5;
                helios.update();
            }
        });

        helios.onNodeHoverEnd((node) => {
            if (node) {
                // Return node to its original size
                helios.nodeSize(n => n._originalSize || 1);
                helios.update();
            }
        });

	
helios.backgroundColor([1.0,1.0,1.0,1.0]);
helios.nodesGlobalSizeScale(0.5);
helios.onNodeDoubleClick((node) => {
		if (node) {
			console.log(`Double Clicked: ${node.ID}`);
			helios.centerOnNodes([node],500);
		} else {
			console.log(`Double clicked on background`);
			helios.centerOnNodes([]); 

		}
	}); 
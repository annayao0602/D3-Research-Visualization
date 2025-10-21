
import { gmlData } from "../data/uva_data.js";
import {Helios} from "https://cdn.skypack.dev/helios-web?min";
import { scaleOrdinal } from "https://cdn.skypack.dev/d3-scale?min";
import { select as d3Select } from "https://cdn.skypack.dev/d3-selection?min";
import { schemeCategory10, schemePaired } from "https://cdn.skypack.dev/d3-scale-chromatic?min";
import { schemeTableau10 } from "https://cdn.skypack.dev/d3-scale-chromatic?min";
import { color as d3Color } from "https://cdn.skypack.dev/d3-color?min";


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

function hexToRgbNormalized(hex) {
            const color = d3Color(hex);
            if (!color) return [0.5, 0.5, 0.5]; // Return grey for invalid colors
            return [color.r / 255, color.g / 255, color.b / 255];
        }

//----CREATING VIZ----

const fieldToGroupMap = {
        'Environmental science': 'Earth Sciences',
        'Geology': 'Earth Sciences',
        'Geography': 'Earth Sciences',
        'Physics': 'Physical Sciences',
        'Chemistry': 'Physical Sciences',
        'Materials science': 'Engineering',
        'Biology': 'Biology',
        'Medicine': 'Medicine',
        'Computer science': 'Computer Science',
        'Mathematics': 'Physical Sciences',
        'Engineering': 'Engineering',
        'Psychology': 'Social Sciences',
        'Sociology': 'Social Sciences',
        'Economics': 'Economics & Business',
        'Political science': 'Social Sciences',
        'Business': 'Economics & Business',
        'History': 'Humanities',
        'Philosophy': 'Humanities',
        'Art': 'Humanities',
    };

    // Helper function to get the group for a given field
    function getGroupForField(field) {
        return fieldToGroupMap[field] || 'Other'; // Default to 'Other' if a field isn't in our map
    }


const parsed = GMLParse(gmlData);

parsed.edges.forEach(edge => {
            if (edge.value) {
                edge.size = Math.max(0.1, Math.log(edge.value)); // Use a log scale for better visuals
            }
        });

const colorProperty = "0"; 

const helios = new Helios({
	elementID: 'netviz', 
	nodes: parsed.nodes, 	
	tracking: true,	
	edges: parsed.edges, 
	colorProperty: colorProperty,
	use2D: false });

//----ADDING NEW FEATURES----
/*
Features to add:
- search bar for authors 
- legend for research fields
- hover effect to show label (author)
- ego network (search person, see who they are connected to)
*/

const colorDomains = [...new Set(
        parsed.nodes.map(node => getGroupForField(node[colorProperty]))
    )].filter(Boolean);
colorDomains.sort(); 
console.log(colorDomains);

const customPalette = [
        '#d81616ff', // Bright Red
        '#ff7b00ff', // Bright Orange
        '#6c3c2dff', // Brown
        '#a61065ff', // Magenta
        '#6a0dad', // Deep Purple
        '#ad5900ff', // Burnt Orange
        '#ffbf1cff', // Gold
        '#800000', // Maroon
        '#ef867bff', // Salmon Pink
        '#855c33ff',  // Tan
		'#9d1c1cff'
        ];

const colorScale = scaleOrdinal(customPalette).domain(colorDomains);

helios.nodeColor(node => {
        const group = getGroupForField(node[colorProperty]);
        return hexToRgbNormalized(colorScale(group));
    });

//----LEGEND----- **TODO: FIX AND DEBUG
const hiddenGroups = new Set();

const legendContainer = d3Select("#legend-items"); 

function applyFilter() {
	const filteredNodes = parsed.nodes.filter(node => {
		const group = getGroupForField(node[colorProperty]);
		return !hiddenGroups.has(group);
	});


}
colorDomains.forEach(domainValue => {
	const legendItem = legendContainer.append("div")
        .attr("class", "legend-item")
        .style("cursor", "pointer"); 

    legendItem.append("div")
        .attr("class", "legend-color-box")
        .style("background-color", colorScale(domainValue));
    
    legendItem.append("span").text(domainValue);
	legendItem.on("click", () => {
		/*
		LOGIC:
		if hidden group contains 1 or more domains:
			hide all other domains except clicked domain
			if any other domain is clicked, unhide it and keep all others hidden
		else if hidden group is empty:
			show all domains
		*/


		//if clicked, make all other groups part of hidden group
        /*if (!hiddenGroups.has(domainValue)) { //if item is in hidden groups, unhide it
            hiddenGroups.delete(domainValue); 
            legendItem.classed("legend-item-hidden", false); 
        } else {
            hiddenGroups.add(all other domains); //if item is not in hidden groups, hide all other classes in hidden groups
            legendItem.classed("legend-item-hidden", true); // Add the greyed-out class.
			console.log(`Hiding group: ${domainValue}`);
        }

        helios.nodeFilter(node => {
            const group = getGroupForField(node[colorProperty]);
            return !hiddenGroups.has(group);
        });

        helios.update();
		console.log(`Toggled group: ${domainValue}`);
		console.log(`Currently hidden groups: ${Array.from(hiddenGroups).join(", ")}`); */
    });
});

//---HOVER INFO BOX---
const infoBox = d3Select("#info-box");
function updateInfoBox(label, field) {
    if (label) {
        infoBox.style("visibility", "visible");
        infoBox.style("opacity", 1);
        // We use .html() here to allow for simple formatting like <strong>
        infoBox.html(`<strong>Selected Author:</strong> ${label} \n <br> <strong>Research Field:</strong> ${field}`);
    } else {
        infoBox.style("visibility", "hidden");
        infoBox.style("opacity", 0);
    }
}

//---NODE INTERACTIONS---
helios.onNodeHoverStart((node, event) => {
	if (node) {
		if (node._originalSize === undefined) {
			node._originalSize = node.size;
		}
		node.size = node._originalSize * 1.5;
		helios.update(); 
		const label = node.Label;
		const field = node[colorProperty];
        updateInfoBox(label, field);
	}
});

helios.onNodeHoverEnd((node) => {
	if (node) {
		// Return node to its original size
		helios.nodeSize(n => n._originalSize || 1);
		helios.update(); 
		updateInfoBox(null);
	}
});


helios.backgroundColor([1.0,1.0,1.0,1.0]);
helios.nodesGlobalSizeScale(0.5);
//----ZOOM ON NODE CLICK----
helios.onNodeDoubleClick((node) => {
		if (node) {
			console.log(`Double Clicked: ${node.ID}`);
			helios.centerOnNodes([node],500);
		} else {
			console.log(`Double clicked on background`);
			helios.centerOnNodes([]); 

		}
	}); 
helios.onNodeClick((node, event) => {
		if (node) {
			helios.centerOnNodes([node],500);
			console.log(`Clicked: ${node.ID}`);
		} else {
			console.log(`Clicked on background`);
		}
	});


import { gmlData } from "../data/uva_data.js";
import HeliosNetwork from "helios-network";
import {
  Helios,
  colormapToScheme,
} from "helios-web";
import { scaleOrdinal } from "https://esm.sh/d3-scale";
import { select as d3Select } from "https://esm.sh/d3-selection";
import { schemeCategory10, schemePaired, schemeTableau10 } from "https://esm.sh/d3-scale-chromatic";
import { color as d3Color } from "https://esm.sh/d3-color";


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

//---GLOBAL STATE VARIABLES----
let highlightedGroup = [];
let currentSearchTerm = "";

//--- TUTORIAL / HELP LOGIC ---
const tutorialModal = document.getElementById("tutorial-modal");
const tutorialContent = document.getElementById("tutorial-content");
const tutorialNext = document.getElementById("tutorial-next");
const questionButton = document.getElementById("question-button");
const tutorialClose = document.getElementById("tutorial-close");

const tutorialSlides = [
    "<h3>Welcome to the Co-Authorship Network</h3><p>This map visualizes connections and collaborations between UVA researchers.</p>",
    "<h3>Interacting with Nodes</h3><p><strong>Hover</strong> over a node to view the author's details.<br><br><strong>Click</strong> to zoom into a specific author, and <strong>Double-click</strong> anywhere to zoom back out.</p>",
    "<h3>Search & Filter</h3><p>Use the <strong>Search Bar</strong> (top right) to find specific authors, or click a field in the <strong>Legend</strong> (bottom left) to isolate specific research domains.</p>"
];

// Only run the tutorial logic if the modal actually exists on this HTML page
if (tutorialModal) {
    let currentSlide = 0;

    function renderSlide(index) {
        currentSlide = index;
        if (tutorialContent) tutorialContent.innerHTML = tutorialSlides[currentSlide];
        
        if (tutorialNext) {
            if (currentSlide === tutorialSlides.length - 1) {
                tutorialNext.innerText = "Show Network";
            } else {
                tutorialNext.innerText = "Next";
            }
        }
    }

    if (tutorialClose) {
        tutorialClose.addEventListener("click", () => {
            tutorialModal.classList.add("hidden");
        });
    }

    if (tutorialNext) {
        tutorialNext.addEventListener("click", () => {
            if (currentSlide < tutorialSlides.length - 1) {
                renderSlide(currentSlide + 1);
            } else {
                tutorialModal.classList.add("hidden");
            }
        });
    }

    if (questionButton) {
        questionButton.addEventListener("click", () => {
            renderSlide(0); 
            tutorialModal.classList.remove("hidden"); 
        });
    }

    renderSlide(0);
}
//----CREATING VIZ----

const fieldToGroupMap = {
	'Environmental science': 'Life Sciences',
	'Geology': 'Life Sciences',
	'Geography': 'Life Sciences',
	'Physics': 'Physical Sciences',
	'Chemistry': 'Physical Sciences',
	'Materials science': 'Engineering',
	'Biology': 'Biochemistry, genetics, and molecular biology',
	'Medicine': 'Medicine',
	'Computer science': 'Engineering',
	'Mathematics': 'Physical Sciences',
	'Engineering': 'Engineering',
	'Psychology': 'Social Sciences',
	'Sociology': 'Social Sciences',
	'Economics': 'Social Sciences',
	'Political science': 'Social Sciences',
	'Business': 'Social Sciences',
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

// ----INITIALIZE-----
const network = await HeliosNetwork.create({ directed: false });

const parsedNodes = Object.values(parsed.nodes); 
const internalNodes = network.addNodes(parsedNodes.length);

const idMap = new Map();
const labels = [];
const fields = [];
const groups = [];

parsedNodes.forEach((node, index) => {
    const internalId = internalNodes[index];
    idMap.set(node.id, internalId); 
    
    labels.push(node.Label || node.label || "");
    fields.push(node[colorProperty]);
    groups.push(getGroupForField(node[colorProperty]));
});

network.nodeAttribute("label", labels);
network.nodeAttribute("field", fields);
network.nodeAttribute("group", groups);

// Categorize the "group" attribute to string
network.nodeAttribute("group", groups, { type: "string" });

network.categorizeNodeAttribute("group");

const categories =
  network.getNodeAttributeCategoryDictionary("group").entries;


const edgePairs = [];
parsed.edges.forEach(edge => {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (source !== undefined && target !== undefined) {
        edgePairs.push([source, target]);
    }
});
network.addEdges(edgePairs);

// --- INITIALIZE HELIOS ---
const helios = new Helios(network, {
  container: document.getElementById("netviz"),
  ui: false,
  quickControls: false,
});


await helios.ready;

const colorsByGroup = new Map([
  ["Biochemistry, genetics, and molecular biology", "#900c3fff"],
  ["Engineering", "#a1339bff"],
  ["Humanities", "#ff5733ff"],
  ["Life Sciences", "#d87040ff"],
  ["Medicine", "#ffc300ff"],
  ["Physical Sciences", "#4b4f8cff"],
  ["Social Sciences", "#d45087ff"],
  ["Other", "#f194b4ff"]
]);


helios.behavior.mappers.setChannelConfig("node", "color", {
  type: "categorical",
  attributes: "group",
  domain: categories.map(({ id }) => id),
  range: categories.map(
    ({ label }) => colorsByGroup.get(label) ?? "#888888ff"
  ),
});

function updateNetworkVisuals() {
    const dynamicRange = categories.map(({ label }) => {
        const baseColor = colorsByGroup.get(label) ?? "#888888ff";
        
        if (highlightedGroup.length === 0) {
            return baseColor; 
        }
        
        if (highlightedGroup.includes(label)) {
            return baseColor;
        } else {
            return baseColor.substring(0, 7) + "1a"; 
        }
    });

    // Push the updated color array back to Helios
    helios.behavior.mappers.setChannelConfig("node", "color", {
        type: "categorical",
        attributes: "group",
        domain: categories.map(({ id }) => id),
        range: dynamicRange,
    });
}

function isNodeActive(nodeIndex) {
    if (highlightedGroup.length === 0) return true; 
    
    const nodeGroup = groups[nodeIndex];
    return highlightedGroup.includes(nodeGroup);
}

helios.nodeSizeScale(0.5); 
helios.behavior.labels.labels({ enabled: false, source: "label" });
if (helios.behavior && helios.behavior.legends) {
    helios.behavior.legends.legends({ enabled: false }); 
}

// ---LEGEND----
const colorDomains = [...new Set(
    Object.values(parsed.nodes).map(node => getGroupForField(node[colorProperty]))
)].filter(Boolean);

colorDomains.sort();

const customColors = [
    "#900c3f",   // deep burgundy
    "#a1339bff", // crimson
    "#ff5733",   // vibrant orange
    "#d87040",   // terracotta
    "#ffc300",   // golden yellow
    "#4b4f8cff", // warm brown
    "#d45087",   // warm rose
    "#f194b4"    // soft pink
];

const colorScale = scaleOrdinal(customColors)
    .domain(colorDomains)
    .unknown("#cccccc"); 

const legendContainer = d3Select("#legend-items"); 

colorDomains.forEach(domainValue => {
	const legendItem = legendContainer.append("div")
        .attr("class", "legend-item")
        .style("cursor", "pointer"); 

    legendItem.append("div")
        .attr("class", "legend-color-box")
        .style("background-color", colorScale(domainValue));

    legendItem.append("span").text(domainValue);
	legendItem.on("click", () => {
		if (highlightedGroup.includes(domainValue)) {
			highlightedGroup = highlightedGroup.filter(g => g !== domainValue);
		} else {
			highlightedGroup.push(domainValue);
		}
		console.log(`Highlighted groups: ${highlightedGroup.join(", ")}`);
		legendContainer.selectAll(".legend-item")
            .style("opacity", function() {
                const text = d3Select(this).select("span").text();
                if (highlightedGroup.length === 0) return 1.0;
                return highlightedGroup.includes(text) ? 1.0 : 0.2;
            });
        updateNetworkVisuals();
        });
    });
//----ADDING NEW FEATURES----
/*
Features to add:
- search bar for authors 
- legend for research fields
- hover effect to show label (author)
- ego network (search person, see who they are connected to)
*/

//---HOVER INFO BOX---
const infoBox = d3Select("#info-box");
function updateInfoBox(label, field) {
    if (label) {
        infoBox.style("visibility", "visible");
        infoBox.style("opacity", 1);
        infoBox.html(`<strong>Selected Author:</strong> ${label} \n <br> <strong>Research Field:</strong> ${field}`);
    } else {
        infoBox.style("visibility", "hidden");
        infoBox.style("opacity", 0);
    }
}

// --- NODE INTERACTIONS ---

// TODO: after checking that the node is active, info box should appear and update with labels and fields.
helios.on("nodeHover", (event) => {
    if (event && event.node !== undefined && isNodeActive(event.node)) {
        const nodeIndex = event.node;
        const label = labels[nodeIndex];
        const field = fields[nodeIndex];
        
        updateInfoBox(label, field);
        d3Select("#netviz").style("cursor", "pointer");
    } else {
        updateInfoBox(null);
        d3Select("#netviz").style("cursor", "default");
    }
});

//TODO: only active nodes should be clickable for zooming in/ centering on
//helios.on("nodeClick", (event) => {...

helios.nodeSizeScale(0.5);
//---SEARCH BAR LOGIC---
const searchInput = document.getElementById("author-search");
const clearBtn = document.getElementById("clear-search");

if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        if (clearBtn) {
            clearBtn.style.display = currentSearchTerm.length > 0 ? "block" : "none";
        }
    });
}

if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = ""; 
        currentSearchTerm = ""; 
        clearBtn.style.display = "none"; 
    });
}





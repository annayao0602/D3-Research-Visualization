
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

const customColors = [
    "#900c3f", // deep burgundy
    "#a1339bff", // crimson
    "#ff5733", // vibrant orange
    "#d87040", // terracotta
	"#ffc300", // golden yellow
    "#4b4f8cff", // warm brown
    "#d45087", // warm rose
    "#f194b4"  // soft pink
];

const colorScale = scaleOrdinal(customColors).domain(colorDomains);

helios.nodeColor(node => {
        const group = getGroupForField(node[colorProperty]);
        return hexToRgbNormalized(colorScale(group));
    });

//----LEGEND----- 
const legendContainer = d3Select("#legend-items"); 

let highlightedGroup = [];

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
        
        updateNetworkColors();
        

        helios.update();
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
	if (!node) return;

	const group = getGroupForField(node[colorProperty]);
    const label = (node.Label || "").toLowerCase();

    const isLegendMatch = highlightedGroup.length === 0 || highlightedGroup.includes(group);
    const isSearchMatch = currentSearchTerm === "" || label.includes(currentSearchTerm);

	if (isLegendMatch && isSearchMatch) {
		if (node._originalSize === undefined) {
			node._originalSize = node.size;
		}
		node.size = node._originalSize * 1.5;
		helios.update(); 
		const label = node.Label;
		d3Select("#netviz").style("cursor", "pointer");
		const field = node[colorProperty];
        updateInfoBox(label, field);
	}
});

helios.onNodeHoverEnd((node, event) => {
	if (node) {
		// Return node to its original size
		node.size = node._originalSize || 1;
		d3Select("#netviz").style("cursor", "default");
		helios.update(); 
		updateInfoBox(null);
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
			helios.centerOnNodes([],500); 

		}
	}); 

helios.onNodeClick((node) => {
	if (!node) {
		return;
	}
	const group = getGroupForField(node[colorProperty]);
    const label = (node.Label || "").toLowerCase();

    const isLegendMatch = highlightedGroup.length === 0 || highlightedGroup.includes(group);
    const isSearchMatch = currentSearchTerm === "" || label.includes(currentSearchTerm);

		if (isLegendMatch && isSearchMatch) {
			helios.centerOnNodes([node],500);
			console.log(`Clicked: ${node.ID}`);
		} else {
			console.log(`Clicked on background`);
		}
	});

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

let currentSlide = 0;

function renderSlide(index) {
    currentSlide = index;
    tutorialContent.innerHTML = tutorialSlides[currentSlide];
    
    if (currentSlide === tutorialSlides.length - 1) {
        tutorialNext.innerText = "Show Network";
    } else {
        tutorialNext.innerText = "Next";
    }
}

tutorialClose.addEventListener("click", () => {
	tutorialModal.classList.add("hidden");
});

tutorialNext.addEventListener("click", () => {
    if (currentSlide < tutorialSlides.length - 1) {
        renderSlide(currentSlide + 1);
    } else {
        tutorialModal.classList.add("hidden");
    }
});

questionButton.addEventListener("click", () => {
    renderSlide(0); 
    tutorialModal.classList.remove("hidden"); 
});

renderSlide(0);

//---SEARCH BAR LOGIC---
const searchInput = document.getElementById("author-search");
let currentSearchTerm = "";
const clearBtn = document.getElementById("clear-search");

function updateNetworkColors() {
    helios.nodeColor(node => {
        const group = getGroupForField(node[colorProperty]);
        const rgb = hexToRgbNormalized(colorScale(group));
        
        const label = (node.Label || "").toLowerCase();

        let isLegendMatch = highlightedGroup.length === 0 || highlightedGroup.includes(group);
        
        let isSearchMatch = currentSearchTerm === "" || label.includes(currentSearchTerm);

        if (isLegendMatch && isSearchMatch) {
            return [rgb[0], rgb[1], rgb[2], 1.0]; 
        } else {  
            return [0.9, 0.9, 0.9, 0.1]; 
        }
    });
    
    helios.update();
}

searchInput.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value.toLowerCase();
	console.log(`Current search term: "${currentSearchTerm}"`);
	if (currentSearchTerm.length > 0) {
        clearBtn.style.display = "block";
    } else {
        clearBtn.style.display = "none";
    }
    updateNetworkColors();
});

clearBtn.addEventListener("click", () => {
    searchInput.value = ""; 
    currentSearchTerm = ""; 
    clearBtn.style.display = "none"; 
    updateNetworkColors(); 
});


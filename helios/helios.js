
import { gmlData } from "../data/uva_data.js";
import HeliosNetwork from "helios-network";
import { Helios } from "helios-web";
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
    
    // Store attributes into arrays to feed into the network
    labels.push(node.Label || node.label || "");
    fields.push(node[colorProperty]);
    groups.push(getGroupForField(node[colorProperty]));
});

// 4. Register node attributes into the network
network.nodeAttribute("label", labels);
network.nodeAttribute("field", fields);
network.nodeAttribute("group", groups);

// 5. Build the edges using the mapped internal IDs
const edgePairs = [];
parsed.edges.forEach(edge => {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (source !== undefined && target !== undefined) {
        edgePairs.push([source, target]);
    }
});
network.addEdges(edgePairs);

const helios = new Helios(network, {
    container: document.getElementById('netviz'), 
	tracking: false,
});

await helios.ready;


/*
if (helios.behavior && helios.behavior.mappers) {
    try {
        // Safely tell the mapper to use your raw RGBA array instead of the default theme
        helios.behavior.mappers.mappers({
            node: {
                color: { 
                    source: "color", 
                    type: "passthrough" 
                }
            }
        });
    } catch (error) {
        console.warn("Mapper configuration skipped:", error);
    }
}
    */


helios.nodeSizeScale(0.5); 
helios.behavior.labels.labels({ enabled: false, source: "label" });
if (helios.behavior && helios.behavior.legends) {
    helios.behavior.legends.legends({ enabled: false }); 
}

//----ADDING NEW FEATURES----
/*
Features to add:
- search bar for authors 
- legend for research fields
- hover effect to show label (author)
- ego network (search person, see who they are connected to)
*/

// Add Object.values() to extract the nodes from the dictionary
const colorDomains = [...new Set(
    Object.values(parsed.nodes).map(node => getGroupForField(node[colorProperty]))
)].filter(Boolean);

colorDomains.sort(); 
console.log("My calculated domains:", colorDomains);

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

updateNetworkColors();

//----LEGEND----- 
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
        
        updateNetworkColors();
        
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

// --- NODE INTERACTIONS ---

// --- 2. HOVER LOGIC (Tooltips) ---

helios.on(EVENTS.NODE_HOVER, (event) => {
    if (event && event.node !== undefined) {
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
/*

// --- 3. CLICK LOGIC (Zooming) ---
if (helios.behavior && helios.behavior.selection) {
    helios.behavior.selection.onClick((event) => {
        if (event && event.node !== undefined) {
            if (helios.camera && helios.camera.centerOnNodes) {
                helios.camera.centerOnNodes([event.node], 500);
            }
        } else {
            if (helios.camera && helios.camera.centerOnNodes) {
                helios.camera.centerOnNodes([], 500);
            }
        }
    });
}
*/

// helios.backgroundColor([1.0,1.0,1.0,1.0]);
helios.nodesGlobalSizeScale(0.5);


//---SEARCH BAR LOGIC---
const searchInput = document.getElementById("author-search");
const clearBtn = document.getElementById("clear-search");

// Only add search listeners if the search bar exists on this HTML page
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        console.log(`Current search term: "${currentSearchTerm}"`);
        if (clearBtn) {
            if (currentSearchTerm.length > 0) {
                clearBtn.style.display = "block";
            } else {
                clearBtn.style.display = "none";
            }
        }
        updateNetworkColors();
    });
}

if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = ""; 
        currentSearchTerm = ""; 
        clearBtn.style.display = "none"; 
        updateNetworkColors(); 
    });
}

function updateNetworkColors() {
    const nodeCount = groups.length; 
    const colorArray = []; 
    const opacityArray = []; // <-- We will manage transparency separately now

    for (let i = 0; i < nodeCount; i++) {
        const group = (groups[i] || "").trim(); 
        const label = (labels[i] || "").toLowerCase();
        const rgb = hexToRgbNormalized(colorScale(group));

        let isLegendMatch = highlightedGroup.length === 0 || highlightedGroup.includes(group);
        let isSearchMatch = currentSearchTerm === "" || label.includes(currentSearchTerm);

        if (isLegendMatch && isSearchMatch) {
            // Visible match: Push exactly 3 elements [R, G, B]
            colorArray.push([rgb[0], rgb[1], rgb[2]]);
            opacityArray.push(1.0); // Fully opaque
        } else {
            // Dimmed/Filtered out: Push light grey
            colorArray.push([0.9, 0.9, 0.9]);
            opacityArray.push(0.1); // Mostly transparent
        }
    }

    // Assign the RGB colors (3 dimensions)
    network.nodeAttribute("color", colorArray);
    
    network.nodeAttribute("opacity", opacityArray);
}

// Call this once right after initializing Helios to apply the initial colors
updateNetworkColors();

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


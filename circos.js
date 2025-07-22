////////////////////////////
//COMPLETE CIRCOS FUNCTION//
////////////////////////////

const CircosChart = function CircosChart(selector, main_data, options) {

    const cfg = {
        margin: {top: 100, right: 200, bottom: 150, left: 200},
        innerRadius: 70,
        maxValue: 0
    }
    cfg.width = 800 - cfg.margin.left - cfg.margin.right;
    cfg.height = 700 - cfg.margin.top - cfg.margin.bottom;
    cfg.outerRadius = Math.min(cfg.width, cfg.height) / 2;
    //alter configs
    if('undefined' !== typeof options){
        for(var i in options){
          if('undefined' !== typeof options[i]){ cfg[i] = options[i]; }
        }
      }
    //find max val in data
    let maxValue = 0;
    for (let j=0; j < main_data.length; j++) {
        for (let i = 0; i < main_data[j].axes.length; i++) {
            main_data[j].axes[i]['id'] = main_data[j].name;
            if (main_data[j].axes[i]['value'] > maxValue) {
              maxValue = main_data[j].axes[i]['value'];
            }
        }
    }
    maxValue = max(cfg.maxValue, maxValue);

    const parent = d3.select(selector);

    let svg = parent.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    let g = svg.append("g")
        .attr("transform", "translate(" + (width / 2 + margin.left) + "," + (height / 2 + margin.top) + ")");

    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    let currentZoomedDomain = null;
    const originalData = main_data;

    //background element
    const backgroundArc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .startAngle(0)
        .endAngle(2* Math.PI);

    const backgroundGroup = svg.append("g").attr("class", "background");
    backgroundGroup.append("path").attr("d", backgroundArc).attr("fill", "#f8f9fa");

    // --- CREATE STATIC CENTER CIRCLE ONCE ---
    const centerCircle = svg.append("circle")
        .attr("class", "center-circle")
        .attr("r", innerRadius - 5)
        .attr("cx", 0)
        .attr("cy", 0)
        .style("opacity", 0) 
        .attr("pointer-events", "none") 
        .on("click", function() {
            if (currentZoomedDomain) {
                currentZoomedDomain = null; 
                update(originalData); 
            }
        });
    
    let x,y;
    function update(data, zoomDomain = null) {
        const oldX = x;
        //d.Domain: change to any column name to abstractify
        const currentData = zoomDomain ? data.filter(d => d.Domain === zoomDomain) : data;

        const t = svg.transition().duration(750);

        centerCircle.transition(t)
            .style("opacity", zoomDomain ? 1: 0)
            .attr("pointer-events", zoomDomain ? "auto" : "none");
        
        currentData.forEach((d, i) => {
            d.value = d.numpub;
        });

        const xDomain = currentData.map(d => d.Field);

        x = d3.scaleBand()
            .domain(xDomain)
            .range([0, 2 * Math.PI])
            .align(0);

        y = d3.scaleLinear()
            .range([innerRadius, outerRadius])
            .domain([0, maxValue])
            .clamp(true);

        // ---- AXES LINES ----
        let yAxisGroup = svg.select("g.axis");
        if (yAxisGroup.empty()) {
            yAxisGroup = svg.append("g").attr("class", "axis");
        }

        const gridData = y.ticks(8).slice(1);
        const gridCircles = yAxisGroup.selectAll(".grid-circle")
            .data(gridData, d => d);
        
        gridCircles.exit().transition(t)
            .attr("r", 0) 
            .style("opacity", 0) 
            .remove();
        
        gridCircles.enter().append("circle")
            .attr("class", "grid-circle")
            .attr("r", 0) 
            .style("opacity", 0) 
            .merge(gridCircles) 
            .transition(t) 
            .attr("r", d => y(d)) 
            .style("opacity", 1);

        const allDomains = [...new Set(originalData.map(d => d.Domain))];
        const domainColor = d3.scaleOrdinal()
            .domain(allDomains)
            .range(["#003f5c", "#58508d", "#bc5090", "#ffa600"]);
        
        const groupedData = d3.nest()
            .key(d => d.Group)
            .entries(currentData);

        const oldGroupedDataMap = new Map(svg.selectAll("g.ideogram-group path").data().map(d => [d.key, d])); 

        groupedData.forEach(group => {
            group.startAngle = x(group.values[0].Field);
            const lastFieldInGroup = group.values[group.values.length - 1].Field;
            group.endAngle = x(lastFieldInGroup) + x.bandwidth();

            const oldGroup = oldGroupedDataMap.get(group.key);
            if (oldGroup) {
                group._current = { 
                    startAngle: oldGroup.startAngle,
                    endAngle: oldGroup.endAngle,
                    innerRadius: outerRadius + 5,
                    outerRadius: outerRadius + 11
                };
            } else {
                group._current = {
                    startAngle: group.startAngle,
                    endAngle: group.startAngle, 
                    innerRadius: outerRadius + 5,
                    outerRadius: outerRadius + 11 
                };
            }
        });

        // --- OUTER RING ---
        const ideogramArc = d3.arc()
            .innerRadius(outerRadius + 5)
            .outerRadius(outerRadius + 11)
            .padAngle(0.01);

        let ideogramGroup = svg.select("g.ideogram-group");
        if (ideogramGroup.empty()) {
            ideogramGroup = svg.append("g").attr("class", "ideogram-group");
        }

        const ideogramPaths = ideogramGroup.selectAll("path")
            .data(groupedData, d => d.key);

        ideogramPaths.exit().transition(t)
            .attrTween("d", function(d) { //complex shape -> sliver
                const i = d3.interpolateObject({ startAngle: d.startAngle, endAngle: d.endAngle, innerRadius: ideogramArc.innerRadius()(), outerRadius: ideogramArc.outerRadius()() },
                                              { startAngle: d.startAngle, endAngle: d.startAngle, innerRadius: ideogramArc.innerRadius()(), outerRadius: ideogramArc.outerRadius()() });
                return function(t_val) { return ideogramArc(i(t_val)); };
            })
            .style("opacity", 0) 
            .remove();

        ideogramPaths.enter().append("path")
            .attr("fill", d => domainColor(d.values[0].Domain))
            .style("stroke", "black")
            .style("stroke-width", "0.3px")
            .style("opacity", 0) //sliver -> complex shape
            .attr("d", d => ideogramArc({ startAngle: d.startAngle, endAngle: d.startAngle, innerRadius: ideogramArc.innerRadius()(), outerRadius: ideogramArc.outerRadius()() }))
            .attr("class", "ideogram-path") 
            .on("click", function(d) {
                if (!currentZoomedDomain) {
                    currentZoomedDomain = d.values[0].Domain;
                    update(originalData, currentZoomedDomain);
                }
            })
        
            .on("mouseover", function(d) {
                tooltip.style("opacity", 1)
                    .html("<strong>Domain:</strong> " + d.values[0].Domain);
                if (!currentZoomedDomain) { // Only apply hover if not already zoomed
                    const hoveredDomain = d.values[0].Domain;
    
                    // Highlight ideograms of the same domain
                    ideogramGroup.selectAll("path.ideogram-path")
                        .filter(ideogramD => ideogramD.values[0].Domain === hoveredDomain)
                        .classed("highlighted-stroke", true);
    
                    // Highlight group labels of the same domain
                    groupLabelGroup.selectAll("g.group-label-container")
                        .filter(labelD => labelD.values[0].Domain === hoveredDomain)
                        .select("text") // Select the text element within the group
                        .style("font-weight", "bold")
                        .style("fill", "#000"); // Darker text color
    
                    d3.select(this).style("cursor", "pointer"); // Change cursor for the hovered ideogram
                }
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (d3.event.pageX + 15) + "px")
                       .style("top", (d3.event.pageY - 20) + "px");
            })
            
            .on("mouseout", function(d) {
                tooltip.style("opacity", 0);
            
                if (!currentZoomedDomain) { // Only remove hover if not already zoomed
                    ideogramGroup.selectAll("path.ideogram-path")
                        .classed("highlighted-stroke", false);
    
                    groupLabelGroup.selectAll("g.group-label-container")
                        .select("text")
                        .style("font-weight", null) 
                        .style("fill", null); 
    
                    d3.select(this).style("cursor", "default"); // Reset cursor
                }
            })
            .merge(ideogramPaths) // Merge enter and update selections
            .transition(t)
                .attrTween("d", function(d) {
                    // Interpolate from _current (previous state) to final state
                    const i = d3.interpolateObject(d._current, {
                        startAngle: d.startAngle,
                        endAngle: d.endAngle,
                        innerRadius: ideogramArc.innerRadius()(),
                        outerRadius: ideogramArc.outerRadius()()
                    });
                    return function(t_val) { return ideogramArc(i(t_val)); };
                })
                .style("opacity", 1);

        // --- OUTER ARC LABELS ---
        let groupLabelGroup = svg.select("g.group-label-group");
        if (groupLabelGroup.empty()) {
            groupLabelGroup = svg.append("g").attr("class", "group-label-group");
        }
    
        const oldLabelPositionsMap = new Map(
            groupLabelGroup.selectAll("g.group-label-container")
                           .data()
                           .map(d => [d.key, d.element]) 
        );

        groupedData.forEach(d => {
            const oldElement = oldLabelPositionsMap.get(d.key); 
            d._currentTransform = oldElement ? d3.select(oldElement).attr("transform") : `rotate(${(d.startAngle + d.endAngle) / 2 * 180 / Math.PI - 90}) translate(${outerRadius + 20},0) scale(0)`; // Start collapsed
            d._targetTransform = `rotate(${(d.startAngle + d.endAngle) / 2 * 180 / Math.PI - 90}) translate(${outerRadius + 20},0) scale(1)`; // End at full size
    
            const oldAngle = oldElement ? ((oldElement.startAngle + oldElement.endAngle) / 2 * 180 / Math.PI - 90) : ((d.startAngle + d.endAngle) / 2 * 180 / Math.PI - 90);
            const newAngle = (d.startAngle + d.endAngle) / 2 * 180 / Math.PI - 90;
            d._currentTextAnchor = oldElement ? d3.select(oldElement).select("text").style("text-anchor") : (oldAngle > 90 && oldAngle < 270 ? "end" : "start");
            d._targetTextAnchor = (newAngle > 90 && newAngle < 270 ? "end" : "start");
            d._currentTextTransform = oldElement ? d3.select(oldElement).select("text").attr("transform") : (oldAngle > 90 && oldAngle < 270 ? "rotate(180)" : "rotate(0)");
            d._targetTextTransform = (newAngle > 90 && newAngle < 270 ? "rotate(180)" : "rotate(0)");
        });

        const groupLabels = groupLabelGroup.selectAll("g.group-label-container")
            .data(groupedData, d => d.key);

        groupLabels.exit().transition(t)
            .style("opacity", 0)
            .attr("transform", d => { 
                const angle = (d.startAngle + d.endAngle) / 2 * 180 / Math.PI - 90;
                const radius = outerRadius + 20;
                return `rotate(${angle}) translate(${radius},0) scale(0)`; 
            })
            .remove();

        const enteringLabels = groupLabels.enter().append("g")
            .attr("class", "group-label-container")
            .style("opacity", 0) 
            .attr("transform", d => d._currentTransform); 
    
        enteringLabels.append("text")
            .text(d => d.key)
            .attr("class", "group-label")
            .style("alignment-baseline", "middle");
            
        groupLabels.merge(enteringLabels)
            .each(function(d) { d.element = this; }) 
            .transition(t)
                .attr("transform", d => d._targetTransform) 
                .style("opacity", 1);
                
        groupLabels.merge(enteringLabels).select("text").transition(t)
            .attr("transform", d => d._targetTextTransform)
            .style("text-anchor", d => d._targetTextAnchor);

        // --- INNER BARS ---
        const barArc = d3.arc()
            .innerRadius(innerRadius); 
    
        let barGroup = svg.select("g.bar-group");
        if (barGroup.empty()) {
            barGroup = svg.append("g").attr("class", "bar-group");
        }

        const oldBarDataMap = new Map(barGroup.selectAll("path").data().map(d => [d.Field, d]));
        currentData.forEach(d => {
            const oldBar = oldBarDataMap.get(d.Field);

            const startAngle = oldBar && oldX ? oldX(oldBar.Field) : x(d.Field);
            const endAngle = oldBar && oldX ? oldX(oldBar.Field) + oldX.bandwidth() : x(d.Field);

            d._current = oldBar ? { 
                innerRadius: innerRadius,
                outerRadius: y(+oldBar.value), 
                startAngle: startAngle,
                endAngle: endAngle
            } : { 
                innerRadius: innerRadius,
                outerRadius: innerRadius, 
                startAngle: x(d.Field),
                endAngle: x(d.Field) 
            };
        });

        const bars = barGroup.selectAll("path")
            .data(currentData, d => d.uniqueId); 
    
        bars.exit().transition(t)
            .attrTween("d", function(d) { 
                const i = d3.interpolateObject({ innerRadius: innerRadius, outerRadius: y(+d.value), startAngle: x(d.Field), endAngle: x(d.Field) + x.bandwidth() },
                                              { innerRadius: innerRadius, outerRadius: innerRadius, startAngle: x(d.Field), endAngle: x(d.Field) });
                return function(t_val) { return barArc(i(t_val)); };
            })
            .style("opacity", 0)
            .remove();

        bars.enter().append("path")
            .attr("fill-opacity", 0) 
            .style("stroke", "black")
            .style("stroke-width", "0.3px")
            .attr("d", d => barArc({ innerRadius: innerRadius, outerRadius: innerRadius, startAngle: x(d.Field), endAngle: x(d.Field) }))
            .on("mouseover", function(d) {
                tooltip.style("opacity", 1);
                tooltip.html(`<strong>${d.Field}</strong><br>Value: ${parseInt(d.value).toLocaleString()}`);
                d3.select(this).attr("fill-opacity", 1);
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (d3.event.pageX + 15) + "px")
                       .style("top", (d3.event.pageY - 20) + "px");
            })
            .on("mouseout", function(d) {
                tooltip.style("opacity", 0);
                d3.select(this).attr("fill-opacity", 0.7);
            })
            .merge(bars) 
            .attr("fill", d => domainColor(d.Domain))

            .transition(t) 
                .attrTween("d", function(d) {
                    const i = d3.interpolateObject(d._current, {
                        innerRadius: innerRadius,
                        outerRadius: y(+d.value),
                        startAngle: x(d.uniqueId),
                        endAngle: x(d.uniqueId) + x.bandwidth()
                    });
                    return function(t_val) { return barArc(i(t_val)); };
                })
                .attr("fill-opacity", 0.7);
            
        toggleAxesVisibility();
    }
    function toggleAxesVisibility() {
        const isChecked = d3.select("#toggle-axes").property("checked");
        svg.select(".axis").classed("axis-hidden", !isChecked);
    }
    update(main_data);
    
    return {
        toggle: toggleAxesVisibility
    };
}


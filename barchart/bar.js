var margin = {top: 20, right: 150, bottom: 40, left: 10},
width = 450 - margin.left - margin.right,
height = 180 - margin.top - margin.bottom;
       
var svg = d3.select("#barchart")
    .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.csv("https://raw.githubusercontent.com/annayao0602/D3-Research-Visualization/main/data/numpub_domain.csv", function(data) {
    data.forEach(function(d) {
        d.numpub_total = +d.numpub_total;
    });

    data.sort((a,b) => b.numpub_total - a.numpub_total);

    const allDomains = [...new Set(data.map(d => d.Domain_total))];
    const domainColor = d3.scaleOrdinal()
        .domain(allDomains)
        .range([ "#58508d","#003f5c","#ffa600","#bc5090"]);
            
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    var x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.numpub_total)])
        .range([ 0, width]);

    var y = d3.scaleBand()
        .range([ 0, height ])
        .domain(data.map(function(d) { return d.Domain_total; }))
        .padding(.1);
    svg.selectAll(".bar-label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.numpub_total) + 10) 
        .attr("y", d => y(d.Domain_total) + y.bandwidth() / 2)
        .attr("dy", "0.35em") 
        .style("font-family", "Jura")
        .style("font-size", "13px")
        .text(d => d.Domain_total);

    svg.selectAll("myRect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", x(0) )
        .attr("y", function(d) { return y(d.Domain_total); })
        .attr("width", function(d) { return x(d.numpub_total); })
        .attr("height", y.bandwidth() )
        .attr("fill", d => domainColor(d.Domain_total))
        .attr("fill-opacity", 0.7)
        .on("mouseover", function(d) {
            tooltip.style("opacity", 1);
            tooltip.html(`Value: ${parseInt(d.numpub_total).toLocaleString()}`);
            d3.select(this).attr("fill-opacity", 1);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (d3.event.pageX - 105) + "px")
                .style("top", (d3.event.pageY - 25) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.style("opacity", 0);
            d3.select(this).attr("fill-opacity", 0.7);
        })
    })
//main.js: handles switching between datasets and loading the Circos SVG

let myCircosChart;

var CircosOptions = {
    margin: {top: 200, right: 200, bottom: 200, left: 200},
    maxValue: 10000
}

function loadDataAndDraw() {
    const selectedFile = d3.select("#dataset-select").property("value");
    const selectedUniversity = d3.select("#dataset-select option:checked").text();
    d3.select("#chart-title").text("Research Publications at " + selectedUniversity);
    
    d3.select("#my_dataviz").html("");
    d3.csv(selectedFile, function(error, data) {
        if (error) throw error;
            myCircosChart = CircosChart("#my_dataviz", data, CircosOptions);
    });
}
d3.select("#dataset-select").on("change", loadDataAndDraw);

d3.select("#toggle-axes").on("change", function() {
    if (myCircosChart) {
        myCircosChart.toggle(); 
    }
});

loadDataAndDraw();
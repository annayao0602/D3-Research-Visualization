let myCircosChart;

var CircosOptions = {
    maxValue: 10000
}

function loadDataAndDraw() {
    const selectedFile = d3.select("#dataset-select").property("value");
    const selectedUniversity = d3.select("#dataset-select option:checked").text();
    d3.select("#chart-title").text("Research Publications at " + selectedUniversity);
    d3.csv(selectedFile, function(error, data) {
        if (error) throw error;
            myCircosChart = CircosChart("#my_dataviz", data, circosOptions);
    });
}

d3.select("#toggle-axes").on("change", function() {
    if (myCircosChart) {
        myCircosChart.toggle(); 
    }
});

loadDataAndDraw();
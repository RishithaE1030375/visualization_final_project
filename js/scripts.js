window.addEventListener("DOMContentLoaded", async () => {
  const map = L.map("map").setView([41.15, -8.61], 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const carIcon = L.icon({
  iconUrl: 'Assets/taxi.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

  const pinIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [24, 24],
    iconAnchor: [12, 24]
  });

  const response = await fetch("js/trips.json");
  const tripData = await response.json();

  let geoJsonLayer = L.geoJSON(tripData, {
    style: { color: "blue", weight: 1 }
  }).addTo(map);

  const taxiCounts = d3.rollups(tripData.features, v => v.length, d => d.properties.taxiid);

  const width = 1000, height = 300;
  const svg = d3.select("#svgContainer").append("svg")
    .attr("width", width)
    .attr("height", height);

  const x = d3.scaleBand()
    .domain(taxiCounts.map(d => d[0]))
    .range([60, width - 10])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(taxiCounts, d => d[1])])
    .range([height - 30, 10]);

  svg.selectAll(".bar")
    .data(taxiCounts)
    .join("rect")
    .attr("class", "bar")
    .attr("x", d => x(d[0]))
    .attr("y", d => y(d[1]))
    .attr("width", x.bandwidth())
    .attr("height", d => height - 30 - y(d[1]))
    .attr("fill", "steelblue")
    .on("click", (event, d) => {
      svg.selectAll(".bar").attr("fill", "steelblue");
      d3.select(event.currentTarget).attr("fill", "orange");
      updateMapForTaxi(d[0]);
      drawPieChart(d[0], tripData.features);
    });

  svg.append("g")
    .attr("transform", `translate(0,${height - 30})`)
    .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 20 === 0)))
    .selectAll("text")
    .attr("transform", "rotate(45)")
    .style("text-anchor", "start");

  svg.append("g")
    .attr("transform", "translate(60,0)")
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 15)
    .attr("x", -height / 2)
    .attr("dy", "-3.5em")
    .style("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Trips Count");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Taxi ID");

  let highlightLayer, markerGroup;

  function updateMapForTaxi(taxiid) {
    if (geoJsonLayer) map.removeLayer(geoJsonLayer);
    if (highlightLayer) map.removeLayer(highlightLayer);
    if (markerGroup) map.removeLayer(markerGroup);

    const filtered = {
      type: "FeatureCollection",
      features: tripData.features.filter(f => f.properties.taxiid === taxiid)
    };
    geoJsonLayer = L.geoJSON(filtered, {
      style: { color: "blue", weight: 1.5 }
    }).addTo(map);
  }

  function drawPieChart(taxiid, data) {
    const pieSvg = d3.select("#pieChart").html("").append("svg")
      .attr("width", 300)
      .attr("height", 350);

    const trips = data.filter(d => d.properties.taxiid === taxiid);
    const pieData = trips.map(d => ({
      label: `Trips by Taxi ID: ${d.properties.tripid}`,
      value: d.properties.duration || 1,
      coords: d.geometry.coordinates
    }));

    const radius = 120;
    const pie = d3.pie().value(d => d.value);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const g = pieSvg.append("g")
      .attr("transform", `translate(${radius},${radius})`);

    const arcs = g.selectAll(".arc")
      .data(pie(pieData))
      .enter().append("g")
      .attr("class", "arc");

    arcs.append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => color(i))
      .on("click", (event, d) => {
        d3.selectAll(".arc path").classed("highlight-arc", false);
        d3.select(event.currentTarget).classed("highlight-arc", true);
        if (highlightLayer) map.removeLayer(highlightLayer);
        if (markerGroup) map.removeLayer(markerGroup);

        highlightLayer = L.geoJSON({
          type: "LineString",
          coordinates: d.data.coords
        }, {
          style: { color: "red", weight: 3 }
        }).addTo(map);

        const start = d.data.coords[0];
        const end = d.data.coords[d.data.coords.length - 1];
        markerGroup = L.layerGroup([
          L.marker([start[1], start[0]], { icon: carIcon }),
          L.marker([end[1], end[0]], { icon: pinIcon })
        ]).addTo(map);
      })
      .append("title")
      .text(d => `${d.data.label}\nDuration: ${d.data.value}s`);

    pieSvg.append("text")
      .attr("x", radius)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text(`Trip Information by Taxi ID: ${taxiid}`);
  }
});

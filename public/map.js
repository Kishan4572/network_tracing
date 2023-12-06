$(async function () {

  var lines, points, networkLines;
  const colors = {
    dark: "#111418",
    highlight: "fuchsia"
  };

  var map = L.map('map').setView([39.94092, -82.00991], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  var pointsLayer = L.featureGroup().addTo(map)
  var lineLayer = L.featureGroup().addTo(map)

  fetchURLs()
    .then(data => {
      buildMap(data);
    });

  async function fetchURLs() {
    console.log("running")
    try {
      const allddataata = await Promise.all([
        $.ajax({
          type: 'get',
          url: '/linenpoint',
        })
      ])

      const data = [allddataata[0].line, allddataata[0].point]

      return data;

    } catch (error) {
      console.log(error);
    }
  }

  async function buildMap(data) {
    data[0].features.map(function (f, i) {
      f.properties.color = "white";
      f.properties.index = i;
      f.id = i;
    });

    lines = {
      type: "FeatureCollection",
      features: []
    };

    data[0].features.map(function (f) {
      if (f.properties.class != "Private") {
        lines.features.push(f);
      }
    });

    networkLines = {
      type: "FeatureCollection",
      features: lines.features.slice(0)
    };

    await addLayer(map, 'geojsonLines', 'line', lines, "color", 4);

    console.log('line data loaded');

    data[1].features.map(function (f, i) {
      f.properties.index = i;
      f.id = i;
    });

    points = {
      type: "FeatureCollection",
      features: data[1].features.slice()
    };

    await addLayer(map, 'points', 'circle', points, colors.dark, 4);
    console.log('point data loaded');

    // Usage
    const networkControl = new NetworkControl({
      options: {
        originPoints: points,
        linearNetwork: networkLines,
        originLayer: pointsLayer,
        color: 'cyan',
        debug: true,
        state: "downstream", // Default state,
        map: map
      }
    });

    // Example: Toggle trace direction
    networkControl.toggleTrace();

    // Example: Start tracing
    networkControl.startTrace();


    $(document).on("click", "#mdstream", function () {
      const state = $(this).val();
      networkControl.toggleTrace();
      if (state === 'upstream') {
        $(this).val("downstream")
        $(this).text("DownStream")
      } else {
        $(this).val("upstream")
        $(this).text("UpStream")
      }
    })

  }

  async function addLayer(m, name, type, data, color, size) {
    var style;
    if (!size && type === 'fill') {
      style = {
        'fillColor': color,
        'fillOpacity': 0.5,
        'color': 'transparent'
      };
    } else {
      style = (type === 'line') ?
        {
          "color": colors.highlight,
          "weight": size
        } : {
          "fillColor": color,
          "radius": size,
          "color": "white",
          "weight": 2,
          "opacity": 0.9
        };
    }

    var layer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        // Customize the circle marker for each point
        return L.circleMarker(latlng, {
          fillOpacity: 0.8
        });
      },
      style: style,  // Style for lines (if any)
      pane: type === 'line' ? 'overlayPane' : 'markerPane'
    }).addTo(m);

    name === 'points' ? pointsLayer.addLayer(layer) : lineLayer.addLayer(layer)
  }

})


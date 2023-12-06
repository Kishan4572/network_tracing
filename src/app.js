const express = require("express")
const app = express()
const hbs = require('hbs')
const path = require("path")
const pool = require("./db")
const wkx = require("wkx")
const fs = require('fs');

const viewPath = path.join(__dirname, "../templates/views")
const staticPath = path.join(__dirname, "../public")

app.set("view engine", "hbs");
app.set("views", viewPath)
// hbs.registerPartials()

app.use(express.static(staticPath))

app.get("/", (req, res) => {
    res.send("welcome")
})

app.get("/map", (req, res) => {
    res.render("map")
})

app.get('/pipelineData', async (req, res) => {

    let featureCollection = {
        "type": "FeatureCollection",
        "features": []
    }
    const pipeline = await pool.query(`SELECT * FROM pipeline_new`)
    const pipeArray = pipeline.rows
    if (pipeArray.length > 0) {

        pipeArray.forEach((element, index) => {

            const geometry = wkx.Geometry.parse(Buffer.from(element.geom, 'hex')).toGeoJSON()
            let properties = {}

            for (let key in element) {
                if (key !== 'geom') {
                    properties[key] = element[key]
                }
            }
            let prop = {
                "type": "Feature",
                geometry: geometry,
                properties: properties
            }
            featureCollection.features.push(prop)
        })

        res.json(featureCollection)
    }

})

// Load GeoJSON data (lines and points)
const linesGeoJSON = JSON.parse(fs.readFileSync('data/lines.geojson', 'utf8'));
const pointsGeoJSON = JSON.parse(fs.readFileSync('data/points.geojson', 'utf8'));

app.get("/linenpoint", (req, res) => {
    res.json({point:pointsGeoJSON, line:linesGeoJSON})
})

app.listen(1111, () => {
    console.log(`Listening at Port http://localhost:1111/map`)
 })
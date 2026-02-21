import Map from 'https://cdn.skypack.dev/ol/Map.js';
import View from 'https://cdn.skypack.dev/ol/View';
import Polygon from 'https://cdn.skypack.dev/ol/geom/Polygon';
import {getLength} from 'https://cdn.skypack.dev/ol/sphere';
import LineString from 'https://cdn.skypack.dev/ol/geom/LineString';
import Draw, {createBox, createRegularPolygon} from 'https://cdn.skypack.dev/ol/interaction/Draw.js';
import TileLayer from 'https://cdn.skypack.dev/ol/layer/Tile';
import VectorLayer from 'https://cdn.skypack.dev/ol/layer/Vector.js';
import OSM from 'https://cdn.skypack.dev/ol/source/OSM.js';
import VectorSource from 'https://cdn.skypack.dev/ol/source/Vector.js';

import Feature from 'https://cdn.skypack.dev/ol/Feature';
import Style from 'https://cdn.skypack.dev/ol/style/Style';
import Fill from 'https://cdn.skypack.dev/ol/style/Fill';
import Stroke from 'https://cdn.skypack.dev/ol/style/Stroke';

const raster = new TileLayer({
  source: new OSM(),
});

const source = new VectorSource({wrapX: false});

const vector = new VectorLayer({
  source: source,
});

const map = new Map({
  layers: [raster, vector],
  target: 'map',
  view: new View({
    center: [-11000000, 4600000],
    zoom: 4,
  }),
});

const typeSelect = document.getElementById('type');


function createSectorGeometryFunction(startAngleDeg = 0, endAngleDeg = 90, steps = 64) {
  return function (coordinates, geometry) {
    const center = coordinates[0];
    const last = coordinates[coordinates.length - 1];

    const dx = center[0] - last[0];
    const dy = center[1] - last[1];
    const radius = Math.sqrt(dx * dx + dy * dy);

    const line = new LineString([center, last]); // координаты в EPSG:3857
    const lengthMetersApprox = getLength(line, {
        projection: 'EPSG:3857', // или 'EPSG:3857', если линия в веб-меркаторе
      });

    // угол поворота, как в Star
    const rotation = Math.atan2(dy, dx) + Math.PI;

    const start = startAngleDeg * Math.PI / 180;
    const end = endAngleDeg * Math.PI / 180;

    const coords = [];
    // центр
    coords.push(center.slice());

    // дуга с учётом поворота
    for (let i = 0; i <= steps; i++) {
      const t = start + (end - start) * (i / steps);
      const angle = rotation + t;
      const x = center[0] + radius * Math.cos(angle);
      const y = center[1] + radius * Math.sin(angle);
      coords.push([x, y]);
    }

    // замыкаем в центр
    coords.push(center.slice());

    if (!geometry) {
      geometry = new Polygon([coords]);
    } else {
      geometry.setCoordinates([coords]);
    }
    
    console.log(lengthMetersApprox);

    return geometry;
  };
}


let draw; // global so we can remove it later
function addInteraction() {
  let value = typeSelect.value;
  if (value !== 'None') {
    let geometryFunction;
    if (value === 'Square') {
      value = 'Circle';
      geometryFunction = createRegularPolygon(4);
    } else if (value === 'Box') {
      value = 'Circle';
      geometryFunction = createBox();
    } else if (value === 'Star') {
      value = 'Circle';
      geometryFunction = function (coordinates, geometry) {
        const center = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        const dx = center[0] - last[0];
        const dy = center[1] - last[1];
        const radius = Math.sqrt(dx * dx + dy * dy);
        const rotation = Math.atan2(dy, dx);
        const newCoordinates = [];
        const numPoints = 12;
        for (let i = 0; i < numPoints; ++i) {
          const angle = rotation + (i * 2 * Math.PI) / numPoints;
          const fraction = i % 2 === 0 ? 1 : 0.5;
          const offsetX = radius * fraction * Math.cos(angle);
          const offsetY = radius * fraction * Math.sin(angle);
          newCoordinates.push([center[0] + offsetX, center[1] + offsetY]);
        }
        newCoordinates.push(newCoordinates[0].slice());
        if (!geometry) {
          geometry = new Polygon([newCoordinates]);
        } else {
          geometry.setCoordinates([newCoordinates]);
        }
        return geometry;
      };
    } else if (value === 'Sector') {
        // наш новый тип
        value = 'Circle';
        // тут задаём нужные углы сектора
        let width = 120
        geometryFunction = createSectorGeometryFunction(-width/2, width/2); // сектор 0–90°
    }

    draw = new Draw({
      source: source,
      type: value,
      geometryFunction: geometryFunction,
    });
    map.addInteraction(draw);
  }
}

/**
 * Handle change event.
 */
typeSelect.onchange = function () {
  map.removeInteraction(draw);
  addInteraction();
};

document.getElementById('undo').addEventListener('click', function () {
  draw.removeLastPoint();
});

addInteraction();

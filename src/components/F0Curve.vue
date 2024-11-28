<!-- src/components/F0Curve.vue -->
<template>
  <svg ref="svgRef" width="100%" :height="height" class="svg-graph"></svg>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import * as d3 from 'd3';
import type { Unit, Data } from '../types';

// Define props and emits
interface Props {
  data: Data | null;
  selectedUnit: Unit | null;
  highlightedUnit: Unit | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'unit-selected', unit: Unit): void;
  (e: 'unit-highlighted', unit: Unit | null): void;
}>();

// References and dimensions
const svgRef = ref<SVGSVGElement | null>(null);
const width = 1200;
const height = 250; // Adjusted height to accommodate f0 curve and labels
const margin = { top: 60, right: 30, bottom: 30, left: 80 };

// Maps to store unit rectangles and boundary handles
const unitRectMap = new Map<
  Unit,
  d3.Selection<SVGRectElement, Unit, SVGGElement, unknown>
>();
const boundaryHandleMap = new Map<
  number, // boundary index
  {
    line: d3.Selection<SVGLineElement, unknown, SVGGElement, unknown>;
    topHandle: d3.Selection<SVGCircleElement, unknown, SVGGElement, unknown>;
    bottomHandle: d3.Selection<SVGCircleElement, unknown, SVGGElement, unknown>;
  }
>();

// Minimum duration for a unit to prevent excessive stretching
const minDuration = 0.1; // seconds

// Function to compute boundaries from units
const computeBoundaries = (): number[] => {
  if (!props.data) return [];
  const boundaries: number[] = [];
  props.data.units.forEach((unit, index) => {
    const startTime =
      unit.f0.segments.length > 0 ? unit.f0.segments[0].start_time : 0;
    const endTime =
      unit.f0.segments.length > 0
        ? unit.f0.segments[unit.f0.segments.length - 1].end_time
        : startTime;
    boundaries.push(startTime);
    if (index === props.data!.units.length - 1) {
      // Add end time of the last unit
      boundaries.push(endTime);
    }
  });
  return boundaries;
};

// Function to draw interactive rectangles for unit selection and highlighting
const drawUnitRectangles = (
  interactionGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>
) => {
  if (!props.data) return;

  // Clear existing rectangles
  unitRectMap.forEach((rect) => rect.remove());
  unitRectMap.clear();

  props.data.units.forEach((unit) => {
    const f0Segments = unit.f0.segments;
    const startTime =
      f0Segments.length > 0 ? f0Segments[0].start_time : 0;
    const endTime =
      f0Segments.length > 0
        ? f0Segments[f0Segments.length - 1].end_time
        : 0;

    const rect = interactionGroup
      .append('rect')
      .datum(unit)
      .attr('x', xScale(startTime))
      .attr('y', margin.top)
      .attr('width', xScale(endTime) - xScale(startTime))
      .attr('height', height - margin.top - margin.bottom)
      .attr('fill', 'transparent') // Make the rectangle fill transparent
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        if (!isDraggingBoundary) {
          emit('unit-highlighted', d);
        }
      })
      .on('mouseout', function () {
        if (!isDraggingBoundary) {
          emit('unit-highlighted', null);
        }
      })
      .on('click', function (event, d) {
        emit('unit-selected', d);
      });

    unitRectMap.set(unit, rect);
  });
};

let isDraggingBoundary = false; // Flag to indicate if a boundary is being dragged

// Function to draw the F0 curve along with boundary lines and phoneme labels
const drawF0Curve = () => {
  if (!props.data || !svgRef.value) {
    console.error('Data or svgRef.value is null');
    return;
  }

  const svg = d3.select(svgRef.value);
  svg.selectAll('*').remove(); // Clear previous drawings

  // Set SVG attributes for responsiveness
  svg
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Compute boundaries
  const boundaries = computeBoundaries();

  // Define scales
  const xScale = d3
    .scaleLinear()
    .domain([0, boundaries[boundaries.length - 1]])
    .range([margin.left, width - margin.right]);

  const yScaleNotes = d3
    .scaleLinear()
    .domain([47, 76]) // MIDI note numbers
    .range([height - margin.bottom, margin.top]);

  // Draw horizontal lines for each MIDI note
  for (let midi = 47; midi <= 76; midi++) {
    svg
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', yScaleNotes(midi))
      .attr('y2', yScaleNotes(midi))
      .attr('stroke', 'lightgray')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 0.5);
  }
  
  // Create SVG groups
  const interactionGroup = svg.append('g').attr('class', 'interaction-group');
  const f0Group = svg.append('g').attr('class', 'f0-group');
  const boundaryGroup = svg.append('g').attr('class', 'boundary-group');
  const labelGroup = svg.append('g').attr('class', 'label-group');
  const axisGroup = svg.append('g').attr('class', 'axis-group');

  // Draw interactive rectangles for unit selection and highlighting
  drawUnitRectangles(interactionGroup, xScale);

  // Draw the F0 curves
  props.data.units.forEach((unit) => {
    unit.f0.segments.forEach((segment) => {
      const segmentData: { time: number; midiNote: number }[] = [];
      const stepSize = 0.01;

      if (segment.kind === 'sustain') {
        const baseFrequency = segment.frequency;
        for (
          let t = segment.start_time;
          t <= segment.end_time;
          t = parseFloat((t + stepSize).toFixed(5))
        ) {
          let vibratoEffect = 0;
          const timeSinceStart = t - segment.start_time;

          if (timeSinceStart < segment.vib_attack_duration) {
            const attackProgress = timeSinceStart / segment.vib_attack_duration;
            vibratoEffect =
              segment.vib_amplitude *
              attackProgress *
              Math.sin(
                2 *
                  Math.PI *
                  segment.vib_frequency *
                  (timeSinceStart + segment.vib_offset)
              );
          } else if (t > segment.end_time - segment.vib_release_duration) {
            const releaseProgress =
              (segment.end_time - t) / segment.vib_release_duration;
            vibratoEffect =
              segment.vib_amplitude *
              releaseProgress *
              Math.sin(
                2 *
                  Math.PI *
                  segment.vib_frequency *
                  (timeSinceStart + segment.vib_offset)
              );
          } else {
            vibratoEffect =
              segment.vib_amplitude *
              Math.sin(
                2 *
                  Math.PI *
                  segment.vib_frequency *
                  (timeSinceStart + segment.vib_offset)
              );
          }

          const currentFrequency = baseFrequency + vibratoEffect;
          const midiNote =
            69 + 12 * Math.log2(currentFrequency / 440); // Convert frequency to MIDI note
          segmentData.push({ time: t, midiNote: midiNote });
        }
      } else if (segment.kind === 'attack' || segment.kind === 'transition') {
        for (
          let t = segment.start_time;
          t <= segment.end_time;
          t = parseFloat((t + stepSize).toFixed(5))
        ) {
          const interpolationRatio =
            (t - segment.start_time) / (segment.end_time - segment.start_time);
          const currentFrequency =
            segment.start_frequency +
            interpolationRatio *
              (segment.end_frequency - segment.start_frequency);
          const midiNote =
            69 + 12 * Math.log2(currentFrequency / 440); // Convert frequency to MIDI note
          segmentData.push({ time: t, midiNote: midiNote });
        }
      }

      // Draw the f0 curve
      f0Group
        .append('path')
        .datum(segmentData)
        .attr('fill', 'none')
        .attr('stroke', 'blue')
        .attr('stroke-width', 1)
        .attr(
          'd',
          d3
            .line<{ time: number; midiNote: number }>()
            .x((d) => xScale(d.time))
            .y((d) => yScaleNotes(d.midiNote))
            .curve(d3.curveCatmullRom)
        );
    });
  });

  // Draw boundary lines and their draggable handles
  boundaries.forEach((boundaryTime, index) => {
    if (index === 0 || index === boundaries.length - 1) {
      // Skip the first and last boundaries
      return;
    }

    const xPos = xScale(boundaryTime);

    // Draw the boundary line
    const line = boundaryGroup
      .append('line')
      .attr('x1', xPos)
      .attr('y1', margin.top)
      .attr('x2', xPos)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('class', 'boundary-line')
      .style('cursor', 'ew-resize')
      .datum({ index });

    // Draw top and bottom handles
    const handleRadius = 3;
    const topHandle = boundaryGroup
      .append('circle')
      .attr('cx', xPos)
      .attr('cy', margin.top)
      .attr('r', handleRadius)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('cursor', 'ew-resize')
      .attr('class', 'boundary-handle')
      .datum({ index });

    const bottomHandle = boundaryGroup
      .append('circle')
      .attr('cx', xPos)
      .attr('cy', height - margin.bottom)
      .attr('r', handleRadius)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('cursor', 'ew-resize')
      .attr('class', 'boundary-handle')
      .datum({ index });

    // Attach drag behavior to both handles and the line
    const drag = d3.drag<Element, { index: number }>()
      .on('start', function (event, d) {
        isDraggingBoundary = true; // Set flag to true
        // Highlight the boundary line and handles
        svg.selectAll('.boundary-line')
          .filter((data) => data.index === d.index)
          .attr('stroke', 'orange');
        svg.selectAll('.boundary-handle')
          .filter((data) => data.index === d.index)
          .attr('stroke', 'orange');
      })
      .on('drag', function (event, d) {
        const [mouseX] = d3.pointer(event, svgRef.value);
        const newBoundaryTime = xScale.invert(mouseX);

        // Get previous and next boundaries
        const prevBoundaryTime = boundaries[d.index - 1] + minDuration;
        const nextBoundaryTime = boundaries[d.index + 1] - minDuration;

        // Clamp the new boundary time
        const clampedTime = Math.max(prevBoundaryTime, Math.min(newBoundaryTime, nextBoundaryTime));

        // Update the boundary time
        boundaries[d.index] = clampedTime;

        // Update the boundary line position
        line.attr('x1', xScale(clampedTime)).attr('x2', xScale(clampedTime));

        // Update handles positions
        topHandle.attr('cx', xScale(clampedTime));
        bottomHandle.attr('cx', xScale(clampedTime));

        // Update units' start_time and end_time based on boundaries
        let cumulativeTime = 0;
        props.data.units.forEach((unit, i) => {
          const unitStartTime = boundaries[i];
          const unitEndTime = boundaries[i + 1];
          const unitDuration = unitEndTime - unitStartTime;

          // Update f0 segments
          if (unit.f0.segments.length > 0) {
            const originalDuration = unit.f0.segments[unit.f0.segments.length - 1].end_time - unit.f0.segments[0].start_time;
            const timeScaleFactor = unitDuration / originalDuration;

            // Adjust all segments within the unit
            let segmentCumulativeTime = unitStartTime;
            unit.f0.segments.forEach((seg) => {
              const segmentDuration = seg.end_time - seg.start_time;
              const newSegmentDuration = segmentDuration * timeScaleFactor;

              // Update segment times
              seg.start_time = segmentCumulativeTime;
              seg.end_time = segmentCumulativeTime + newSegmentDuration;
              segmentCumulativeTime += newSegmentDuration;
            });
          }

          // Update loudness segments similarly
          if (unit.loudness.segments.length > 0) {
            const originalDuration = unit.loudness.segments[unit.loudness.segments.length - 1].end_time - unit.loudness.segments[0].start_time;
            const timeScaleFactor = unitDuration / originalDuration;

            let segmentCumulativeTime = unitStartTime;
            unit.loudness.segments.forEach((seg) => {
              const segmentDuration = seg.end_time - seg.start_time;
              const newSegmentDuration = segmentDuration * timeScaleFactor;

              // Update segment times
              seg.start_time = segmentCumulativeTime;
              seg.end_time = segmentCumulativeTime + newSegmentDuration;
              segmentCumulativeTime += newSegmentDuration;
            });
          }
        });

        // Redraw the curve with updated boundaries
        drawF0Curve();
      })
      .on('end', function (event, d) {
        isDraggingBoundary = false; // Reset flag
        // Reset the boundary line and handles stroke
        svg.selectAll('.boundary-line')
          .filter((data) => data.index === d.index)
          .attr('stroke', 'black');
        svg.selectAll('.boundary-handle')
          .filter((data) => data.index === d.index)
          .attr('stroke', 'black');
      });

    // Apply drag behavior to both handles and the line
    topHandle.call(drag);
    bottomHandle.call(drag);
    line.call(drag);

    // Store the handles in the map
    boundaryHandleMap.set(index, { line, topHandle, bottomHandle });
  });

  // Add phoneme labels at the top
  props.data.units.forEach((unit, index) => {
    const unitStartTime = boundaries[index];
    const unitEndTime = boundaries[index + 1];
    const phonemeX = (xScale(unitStartTime) + xScale(unitEndTime)) / 2;
    const phonemeY = margin.top / 2 + 10;

    labelGroup
      .append('text')
      .attr('x', phonemeX)
      .attr('y', phonemeY)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text(unit.vowel);
  });

  // Add x-axis
  const xAxis = d3.axisBottom(xScale);
  axisGroup
    .append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(xAxis);

  // Add y-axis for f0
  const yAxisNotes = d3
    .axisLeft(yScaleNotes)
    .tickFormat((d) => {
      const notes = [
        'C',
        'C#',
        'D',
        'D#',
        'E',
        'F',
        'F#',
        'G',
        'G#',
        'A',
        'A#',
        'B',
      ];
      const note = notes[d % 12];
      const octave = Math.floor(d / 12) - 1;
      return `${note}${octave}`;
    });

  axisGroup
    .append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(yAxisNotes);

  // Add y-axis label
  axisGroup
    .append('text')
    .attr(
      'transform',
      `translate(${margin.left - 50}, ${
        margin.top + (height - margin.top - margin.bottom) / 2
      }) rotate(-90)`
    )
    .style('text-anchor', 'middle')
    .text('f₀');

  // Initial highlighting update
  updateHighlighting();
};

// Function to update highlighting based on selected and highlighted units
const updateHighlighting = () => {
  unitRectMap.forEach((rect, unit) => {
    const isSelected = props.selectedUnit === unit;
    const isHighlighted = props.highlightedUnit === unit;

    let fill = 'transparent';
    if (isSelected) {
      fill = 'rgba(30, 144, 255, 0.2)'; // Selected color
    } else if (isHighlighted) {
      fill = 'rgba(173, 216, 230, 0.2)'; // Highlighted color
    }

    rect.attr('fill', fill);
  });
};

// Initialize the component
onMounted(() => {
  // drawF0Curve();
});

// Watch for changes in selectedUnit and highlightedUnit to update highlighting
watch(
  [() => props.selectedUnit, () => props.highlightedUnit],
  () => {
    updateHighlighting();
  }
);

// Redraw the curve when data changes
watch(
  () => props.data,
  async (newData) => {
    if (newData) {
      await nextTick(); // Wait for DOM updates to ensure svgRef.value is set
      drawF0Curve();
    }
  },
  { deep: true } // Add deep watcher to detect changes within the data
);
</script>

<style scoped>
svg {
  width: 100%;
  height: auto;
  min-width: 600px; /* Set a reasonable minimum width */
}

.boundary-line {
  stroke: black;
  stroke-width: 2;
  cursor: ew-resize;
  pointer-events: stroke; /* Ensure only the stroke is interactive */
}

.boundary-line:hover {
  stroke: orange;
}

.boundary-handle {
  fill: white;
  stroke: black;
  stroke-width: 1;
  cursor: ew-resize;
}

.boundary-handle:hover {
  stroke: orange;
}

.text-label {
  font-size: 14px;
  font-weight: bold;
}

.interaction-group rect {
  /* Ensure that rects are below boundary handles */
  pointer-events: all;
}

.boundary-group {
  pointer-events: all;
}

.interaction-group {
  pointer-events: all;
}
</style>

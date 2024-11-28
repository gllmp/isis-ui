<!-- src/components/LoudnessCurve.vue -->
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
  (e: 'timings-updated'): void; // Add timings-updated event
}>();

// References and dimensions
const svgRef = ref<SVGSVGElement | null>(null);
const width = 1200;
const height = 250; // Adjusted height for loudness curve
const margin = { top: 60, right: 30, bottom: 30, left: 80 };

// Map to store unit rectangles
const unitRectMap = new Map<
  Unit,
  d3.Selection<SVGRectElement, Unit, SVGGElement, unknown>
>();

// Flag to indicate if a boundary is being dragged
let isDraggingBoundary = false;

// Minimum duration to prevent overlapping boundaries
const minDuration = 0.1; // seconds

// Function to compute boundaries from units
const computeBoundaries = (): number[] => {
  if (!props.data) return [];
  const boundaries: number[] = [];
  props.data.units.forEach((unit, index) => {
    const startTime =
      unit.loudness.segments.length > 0 ? unit.loudness.segments[0].start_time : 0;
    const endTime =
      unit.loudness.segments.length > 0
        ? unit.loudness.segments[unit.loudness.segments.length - 1].end_time
        : startTime;
    boundaries.push(startTime);
    if (index === props.data!.units.length - 1) {
      // Add end time of the last unit
      boundaries.push(endTime);
    }
  });
  return boundaries;
};

const drawLoudnessCurve = () => {
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

  const yScaleLoudness = d3
    .scaleLinear()
    .domain([0, 100]) // Loudness values from 0 to 100
    .range([height - margin.bottom, margin.top]);

  // Add horizontal grid lines for each integer value
  for (let i = 0; i <= 100; i += 10) {
    svg
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', yScaleLoudness(i))
      .attr('y2', yScaleLoudness(i))
      .attr('stroke', 'lightgray')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 0.5);
  }

  // Add groups
  const interactionGroup = svg.append('g').attr('class', 'interaction-group');
  const loudnessGroup = svg.append('g').attr('class', 'loudness-group');
  const boundaryGroup = svg.append('g').attr('class', 'boundary-group');
  const labelGroup = svg.append('g').attr('class', 'label-group');
  const axisGroup = svg.append('g').attr('class', 'axis-group');

  // Iterate over each unit to draw the loudness curve and interactive areas
  props.data.units.forEach((unit, index) => {
    const startTime = boundaries[index];
    const endTime = boundaries[index + 1];

    // Process loudness segments
    unit.loudness.segments.forEach((segment) => {
      const segmentData: { time: number; loudness: number }[] = [];
      const stepSize = 0.01;

      for (
        let t = segment.start_time;
        t <= segment.end_time;
        t = parseFloat((t + stepSize).toFixed(5))
      ) {
        let loudness = 0;

        const timeSinceStart = t - segment.start_time;
        const timeToEnd = segment.end_time - t;

        if (segment.kind === 'vowel') {
          const attack_duration = segment.attack_duration;
          const release_duration = segment.release_duration;
          const scale_factor = segment.scale_factor;
          const accent_factor = segment.accent_factor;

          const maxLoudnessLevel = scale_factor * accent_factor * 100; // Scaled to 100%

          if (timeSinceStart <= attack_duration && attack_duration > 0) {
            // Attack phase
            const attackProgress = timeSinceStart / attack_duration;
            loudness = attackProgress * maxLoudnessLevel;
          } else if (timeToEnd <= release_duration && release_duration > 0) {
            // Release phase
            const releaseProgress = timeToEnd / release_duration;
            loudness = releaseProgress * maxLoudnessLevel;
          } else {
            // Sustain phase
            loudness = maxLoudnessLevel;
          }
        } else if (segment.kind === 'loudnesssilence') {
          loudness = 0;
        } else {
          // Handle other kinds if necessary
          loudness = 0;
        }

        segmentData.push({ time: t, loudness: loudness });
      }

      // Draw the loudness curve
      loudnessGroup
        .append('path')
        .datum(segmentData)
        .attr('fill', 'none')
        .attr('stroke', 'green')
        .attr('stroke-width', 1)
        .attr(
          'd',
          d3
            .line<{ time: number; loudness: number }>()
            .x((d) => xScale(d.time))
            .y((d) => yScaleLoudness(d.loudness))
            .curve(d3.curveLinear)
        );
    });

    // Add interactivity
    const rect = interactionGroup
      .append('rect')
      .datum(unit)
      .attr('x', xScale(startTime))
      .attr('y', margin.top)
      .attr('width', xScale(endTime) - xScale(startTime))
      .attr('height', height - margin.top - margin.bottom)
      .attr('fill', 'transparent')
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

    // Add phoneme labels at the top
    const phonemeX = (xScale(startTime) + xScale(endTime)) / 2;
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
        const unitIndex = d.index - 1; // Since boundaries are between units
        if (props.data && props.data.units[unitIndex]) {
          const unit = props.data.units[unitIndex];
          const nextUnit = props.data.units[unitIndex + 1];

          // Update current unit's timings
          updateUnitTimings(unit, boundaries[unitIndex], boundaries[unitIndex + 1]);

          // Update next unit's timings if it exists
          if (nextUnit) {
            updateUnitTimings(nextUnit, boundaries[unitIndex + 1], boundaries[unitIndex + 2]);
          }
        }

        // Redraw the curve with updated boundaries
        drawLoudnessCurve();
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

        // Emit event to notify parent that timings have been updated
        emit('timings-updated');
      });

    // Apply drag behavior to both handles and the line
    topHandle.call(drag);
    bottomHandle.call(drag);
    line.call(drag);
  });

  // Add x-axis
  const xAxis = d3.axisBottom(xScale);
  axisGroup
    .append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .attr('class', 'x-axis') // Add class for zooming
    .call(xAxis);

  // Add y-axis for loudness
  const yAxisLoudness = d3.axisLeft(yScaleLoudness).ticks(10);
  axisGroup
    .append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .attr('class', 'y-axis') // Add class for zooming
    .call(yAxisLoudness);

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
    .text('Loudness (dB)');

  // Initial highlighting update
  updateHighlighting();
};

// Function to update unit timings
const updateUnitTimings = (unit: Unit, startTime: number, endTime: number) => {
  const unitDuration = endTime - startTime;
  const originalStartTime = unit.loudness.segments[0].start_time;
  const originalEndTime = unit.loudness.segments[unit.loudness.segments.length - 1].end_time;
  const originalTotalDuration = originalEndTime - originalStartTime;
  const timeScaleFactor = unitDuration / originalTotalDuration;

  // Update loudness segments
  let segmentCumulativeTime = startTime;
  unit.loudness.segments.forEach((seg) => {
    const segmentDuration = seg.end_time - seg.start_time;
    const newSegmentDuration = segmentDuration * timeScaleFactor;

    seg.start_time = segmentCumulativeTime;
    seg.end_time = segmentCumulativeTime + newSegmentDuration;

    segmentCumulativeTime += newSegmentDuration;
  });

  // Update f0 segments similarly
  segmentCumulativeTime = startTime;
  unit.f0.segments.forEach((seg) => {
    const segmentDuration = seg.end_time - seg.start_time;
    const newSegmentDuration = segmentDuration * timeScaleFactor;

    seg.start_time = segmentCumulativeTime;
    seg.end_time = segmentCumulativeTime + newSegmentDuration;

    segmentCumulativeTime += newSegmentDuration;
  });
};

// Function to update highlighting
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

onMounted(() => {
  // drawLoudnessCurve();
});

// Redraw the curve when data changes
watch(
  () => props.data,
  async (newData) => {
    if (newData) {
      await nextTick(); // Wait for DOM updates to ensure svgRef.value is set
      drawLoudnessCurve();
    }
  },
  { deep: true } // Add deep watcher to detect changes within the data
);

// Watch for changes in selectedUnit and highlightedUnit
watch(
  [() => props.selectedUnit, () => props.highlightedUnit],
  () => {
    updateHighlighting();
  }
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
</style>

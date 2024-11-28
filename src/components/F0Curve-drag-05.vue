<!-- src/components/F0Curve.vue -->
<template>
  <svg ref="svgRef" width="100%" :height="height"></svg>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import * as d3 from 'd3';
import type { Unit, Data, Segment } from '../types';

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
const height = 600; // Adjusted height to accommodate f0 curve and labels
const margin = { top: 60, right: 30, bottom: 30, left: 80 };

// Maps to store unit rectangles and boundary handles
const unitRectMap = new Map<
  Unit,
  d3.Selection<SVGRectElement, Unit, SVGGElement, unknown>
>();
const boundaryHandleMap = new Map<
  string, // boundary identifier
  {
    topHandle: d3.Selection<SVGCircleElement, { boundary: string }, SVGGElement, unknown>;
    bottomHandle: d3.Selection<SVGCircleElement, { boundary: string }, SVGGElement, unknown>;
  }
>();

// Minimum duration for a unit to prevent excessive stretching
const minDuration = 0.1; // seconds

// Function to compute boundaries from units
const computeBoundaries = (): number[] => {
  if (!props.data) return [];
  const boundaries: number[] = [];
  props.data.units.forEach((unit) => {
    const endTime =
      unit.f0.segments.length > 0
        ? unit.f0.segments[unit.f0.segments.length - 1].end_time
        : 0;
    boundaries.push(endTime);
  });
  // Add the end boundary if totalDuration is defined and not already present
  if (
    props.data.duration &&
    boundaries[boundaries.length - 1] !== props.data.duration
  ) {
    boundaries.push(props.data.duration);
  }
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
        emit('unit-highlighted', d);
      })
      .on('mouseout', function () {
        emit('unit-highlighted', null);
      })
      .on('click', function (event, d) {
        emit('unit-selected', d);
      });

    unitRectMap.set(unit, rect);
  });
};

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

  // Define scales
  const xScale = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(props.data.units, (unit) =>
        d3.max(unit.f0.segments, (seg) => seg.end_time)
      ) || 0,
    ])
    .range([margin.left, width - margin.right]);

  const yScaleNotes = d3
    .scaleLinear()
    .domain([47, 76]) // MIDI note numbers
    .range([height - margin.bottom, margin.top]);

  // Create SVG groups
  const interactionGroup = svg.append('g').attr('class', 'interaction-group');
  const f0Group = svg.append('g').attr('class', 'f0-group');
  const boundaryGroup = svg.append('g').attr('class', 'boundary-group');
  const labelGroup = svg.append('g').attr('class', 'label-group');
  const axisGroup = svg.append('g').attr('class', 'axis-group');

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
        .attr('stroke-width', 1.5)
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

  // Compute boundaries
  const boundaries = computeBoundaries();

  // Draw boundary lines and their draggable handles
  boundaries.forEach((boundaryTime, index) => {
    const boundaryId = `boundary-${index}`;
    const xPos = xScale(boundaryTime);

    // Draw the boundary line
    const line = boundaryGroup
      .append('line')
      .attr('x1', xPos)
      .attr('y1', margin.top)
      .attr('x2', xPos)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('class', 'boundary-line')
      .attr('data-boundary-id', boundaryId)
      .style('cursor', 'ew-resize')
      .datum({ boundary: boundaryId }); // Bind datum correctly

    // Draw top and bottom handles
    const handleRadius = 6;
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
      .attr('data-boundary-id', boundaryId)
      .datum({ boundary: boundaryId }); // Bind datum correctly

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
      .attr('data-boundary-id', boundaryId)
      .datum({ boundary: boundaryId }); // Bind datum correctly

    // Attach drag behavior to both handles and the line
    const drag = d3.drag<Element, { boundary: string }>()
      .on('start', function (event, d) {
        // Highlight the boundary line and handles
        svg.selectAll(`[data-boundary-id="${d.boundary}"]`)
          .attr('stroke', 'orange');
      })
      .on('drag', function (event, d) {
        const [mouseX] = d3.pointer(event, svgRef.value);
        const newBoundaryTime = xScale.invert(mouseX);

        // Get previous and next boundaries
        const prevBoundaryTime = boundaries[index - 1] || 0;
        const nextBoundaryTime = boundaries[index + 1] || (props.data?.duration || newBoundaryTime + minDuration);

        // Enforce minimum duration for the previous and next units
        const minPrev = prevBoundaryTime + minDuration;
        const minNext = newBoundaryTime + minDuration;

        // Clamp the new boundary time
        const clampedTime = Math.max(newBoundaryTime, minPrev);
        const finalBoundaryTime = Math.min(clampedTime, nextBoundaryTime - minDuration);

        // If the boundary hasn't changed, do nothing
        if (finalBoundaryTime === boundaries[index]) return;

        // Update the boundary time
        boundaries[index] = finalBoundaryTime;

        // Update the boundary line position
        svg.selectAll(`[data-boundary-id="${d.boundary}"]`)
          .attr('x1', xScale(finalBoundaryTime))
          .attr('x2', xScale(finalBoundaryTime));

        // Update handles positions
        svg.selectAll(`.boundary-handle[data-boundary-id="${d.boundary}"]`)
          .attr('cx', xScale(finalBoundaryTime));

        // Update units' start_time and end_time based on boundaries
        props.data.units.forEach((unit, uIndex) => {
          const unitStart = boundaries[uIndex - 1] || 0;
          const unitEnd = boundaries[uIndex] || (props.data?.duration || unitStart + minDuration);

          const originalUnitDuration = unit.f0.segments[unit.f0.segments.length - 1].end_time - unit.f0.segments[0].start_time;
          const newUnitDuration = unitEnd - unitStart;
          const timeScaleFactor = newUnitDuration / originalUnitDuration;

          // Update f0 segments
          if (unit.f0.segments.length > 0) {
            // Adjust all segments within the unit
            let cumulativeDuration = unitStart;
            unit.f0.segments.forEach((seg) => {
              const segmentDuration = seg.end_time - seg.start_time;
              const newSegmentDuration = segmentDuration * timeScaleFactor;

              // Update segment times
              seg.start_time = cumulativeDuration;
              seg.end_time = cumulativeDuration + newSegmentDuration;
              cumulativeDuration += newSegmentDuration;

              // Adjust vibrato frequency or other time-dependent parameters if necessary
              // For example, if vibrato frequency depends on duration
              // seg.vib_frequency = adjustVibratoFrequency(seg, timeScaleFactor);
            });
          }
        });

        // Redraw the curve with updated boundaries
        drawF0Curve();
      })
      .on('end', function (event, d) {
        // Reset the boundary line and handles stroke
        svg.selectAll(`[data-boundary-id="${d.boundary}"]`)
          .attr('stroke', 'black');
      });

    // Apply drag behavior to both handles and the line
    topHandle.call(drag);
    bottomHandle.call(drag);
    line.call(drag);

    // Store the handles in the map
    boundaryHandleMap.set(boundaryId, { topHandle, bottomHandle });
  });

  // Add phoneme labels at the top
  props.data.units.forEach((unit, index) => {
    const boundaryTime = boundaries[index];
    const nextBoundaryTime = boundaries[index + 1] || (props.data?.duration || boundaryTime + minDuration);
    const phonemeX = (xScale(boundaryTime) + xScale(nextBoundaryTime)) / 2;
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
    .text('Pitch (MIDI)');

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
  drawF0Curve();
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

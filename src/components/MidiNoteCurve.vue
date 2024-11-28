<!-- src/components/MidiNoteCurve.vue -->
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
const height = 250; // Adjust the height as needed
const margin = { top: 20, right: 30, bottom: 30, left: 80 };

// Map to store unit rectangles
const unitRectMap = new Map<
 Unit,
 d3.Selection<SVGRectElement, Unit, SVGGElement, unknown>
>();

// Add a reference to store y-axis labels
const yAxisLabels = ref<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

const drawMidiNoteGraph = () => {
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

 // Determine the MIDI note range from the data
 const midiNotes = props.data.units.map((unit) => unit.note.midi);

 const midiMin = Math.floor(d3.min(midiNotes) || 48);
 const midiMax = Math.ceil(d3.max(midiNotes) || 72);

 const yScale = d3
   .scaleLinear()
   .domain([midiMin - 1, midiMax + 1]) // Add some padding
   .range([height - margin.bottom, margin.top]);

 // Draw horizontal lines for each MIDI note
 for (let midi = midiMin; midi <= midiMax; midi++) {
   svg
     .append('line')
     .attr('x1', margin.left)
     .attr('x2', width - margin.right)
     .attr('y1', yScale(midi))
     .attr('y2', yScale(midi))
     .attr('stroke', 'lightgray')
     .attr('stroke-dasharray', '4,4')
     .attr('stroke-width', 0.5);
 }

 // Add a group to hold the unit rectangles
 const unitsGroup = svg.append('g').attr('class', 'units-group');

 // Iterate over each unit to draw rectangles representing MIDI notes
 props.data.units.forEach((unit) => {
   const f0Segments = unit.f0.segments;
   const startTime = f0Segments.length > 0 ? f0Segments[0].start_time : 0;
   const endTime =
     f0Segments.length > 0
       ? f0Segments[f0Segments.length - 1].end_time
       : 0;

   // Use the MIDI note from unit.note.midi
   const midiNote = unit.note.midi;

   if (midiNote !== null) {
     const rectHeight = yScale(midiNote - 0.5) - yScale(midiNote + 0.5);

     // Calculate opacity based on velocity (0.2 to 1)
     const opacity = Math.max(0.2, unit.note.velocity / 127);

     const rect = unitsGroup
       .append('rect')
       .datum(unit)
       .attr('x', xScale(startTime))
       .attr('y', yScale(midiNote + 0.5))
       .attr('width', xScale(endTime) - xScale(startTime))
       .attr('height', Math.abs(rectHeight))
       .attr('fill', 'steelblue')
       .attr('fill-opacity', opacity) // Set opacity
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

     // Add phoneme labels at the top of each rectangle
     const phonemeX = (xScale(startTime) + xScale(endTime)) / 2;
     const phonemeY = yScale(midiNote + 0.5) - 5; // Position above the rectangle

     svg
       .append('text')
       .attr('x', phonemeX)
       .attr('y', phonemeY)
       .attr('text-anchor', 'middle')
       .attr('alignment-baseline', 'baseline')
       .style('font-size', '12px')
       .style('font-weight', 'bold')
       .text(unit.vowel);
   }
 });

 // Add x-axis
 const xAxis = d3.axisBottom(xScale);
 svg
   .append('g')
   .attr('transform', `translate(0,${height - margin.bottom})`)
   .call(xAxis);

 // Add y-axis for MIDI notes
 const yAxisMidi = d3
   .axisLeft(yScale)
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
   })
   .ticks(midiMax - midiMin);

 // Store y-axis labels selection
 yAxisLabels.value = svg
   .append('g')
   .attr('transform', `translate(${margin.left},0)`)
   .call(yAxisMidi);

 // Add y-axis label
 svg
   .append('text')
   .attr(
     'transform',
     `translate(${margin.left - 50}, ${
       margin.top + (height - margin.top - margin.bottom) / 2
     }) rotate(-90)`
   )
   .style('text-anchor', 'middle')
   .text('MIDI Note');

 // Initial highlighting update
 updateHighlighting();
};

// Function to update highlighting
const updateHighlighting = () => {
 unitRectMap.forEach((rect, unit) => {
   const isSelected = props.selectedUnit === unit;
   const isHighlighted = props.highlightedUnit === unit;

   let fill = 'steelblue';
   if (isSelected) {
     fill = 'orange'; // Selected color
   } else if (isHighlighted) {
     fill = 'lightblue'; // Highlighted color
   }

   rect.attr('fill', fill);

   // Adjust opacity based on velocity
   const opacity = Math.max(0.2, unit.note.velocity / 127);
   rect.attr('fill-opacity', opacity);

   // Highlight corresponding y-axis label
   if (isHighlighted && yAxisLabels.value) {
     const midiNote = unit.note.midi;
     yAxisLabels.value
       .selectAll('.tick text')
       .filter((d) => d === Math.round(midiNote))
       .attr('fill', 'red')
       .attr('font-weight', 'bold');
   } else if (yAxisLabels.value) {
     // Reset all labels
     yAxisLabels.value
       .selectAll('.tick text')
       .attr('fill', 'black')
       .attr('font-weight', 'normal');
   }
 });
};

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

onMounted(() => {
 // drawMidiNoteGraph();
});

// Redraw the graph when data changes
watch(
 () => props.data,
 async (newData) => {
   if (newData) {
     await nextTick(); // Wait for DOM updates to ensure svgRef.value is set
     drawMidiNoteGraph();
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
</style>

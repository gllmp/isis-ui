<!-- src/components/F0Curve.vue -->
<template>
  <svg ref="svgRef" width="100%" :height="height"></svg>
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
 const height = 600; // Adjusted height to accommodate f0 curve and labels
 const margin = { top: 60, right: 30, bottom: 30, left: 80 };
 
 // Map to store unit rectangles
 const unitRectMap = new Map<
  Unit,
  d3.Selection<SVGRectElement, Unit, SVGGElement, unknown>
 >();
 
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
 
  // Add a group to hold the interactive rectangles
  const interactionGroup = svg.append('g').attr('class', 'interaction-group');
 
  // Iterate over each unit to draw the f0 curve and interactive areas
  props.data.units.forEach((unit) => {
    // Process f0 segments
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
      svg
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
 
    // Add interactivity
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
      .attr('fill', 'transparent')
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
 
    // Add phoneme labels at the top
    const phonemeX = (xScale(startTime) + xScale(endTime)) / 2;
    const phonemeY = margin.top / 2 + 10;
 
    svg
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
  svg
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
 
  svg
    .append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(yAxisNotes);
 
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
    .text('Pitch (MIDI)');
 
  // Initial highlighting update
  updateHighlighting();
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
  // drawF0Curve();
 });
 
 // Watch for changes in selectedUnit and highlightedUnit
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
 </style>
 
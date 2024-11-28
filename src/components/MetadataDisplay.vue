<!-- src/components/MetadataDisplay.vue -->
<template>
  <div v-if="unit" class="metadata-container">
    <!-- New Information Block -->
    <div class="info-block">
      <h3>{{ dataName }}</h3>
      <div class="info-data">
        <p><span class="bold">Total Duration:</span> {{ totalDuration.toFixed(2) }} s</p>
        <p><span class="bold">Tempo:</span> {{ tempo }} BPM</p>
      </div>
    </div>
    
    <!-- Selected Unit Information -->
    <div class="unit-info-block">
      <h4>Unit #{{ unitIndex + 1 }} - Duration: {{ unitDuration.toFixed(2) }} s</h4>
      <div class="info-data">
        <p><span class="bold">Start Time:</span> {{ unitStartTime.toFixed(2) }} s</p>
        <p><span class="bold">End Time:</span> {{ unitEndTime.toFixed(2) }} s</p>
      </div>
    </div>

    <!-- Add/Remove Buttons -->
    <div class="button-group">
      <button @click="$emit('add-unit')">Add Phoneme</button>
      <button @click="$emit('remove-unit')">Remove Phoneme</button>
    </div>

    <!-- Editable Vowel Input -->
    <div class="unit-info-block">
      <h3>
        Vowel:
        <select v-model="unit.vowel">
          <option
            v-for="(vowelOption, index) in vowelOptions"
            :key="index"
            :value="vowelOption"
          >
            {{ vowelOption }}
          </option>
        </select>
      </h3>
    </div>

    <!-- f₀ Information -->
    <div class="unit-info-block">
      <h3>f₀</h3>
      <div
        v-for="(segment, index) in unit.f0.segments"
        :key="'f0-segment-' + index"
        class="segment-block"
      >
        <!-- Editable Segment Kind -->
        <div>
          <h4> {{ capitalize(segment.kind) }}</h4>
          <!-- <label>
            Kind:
            <select v-model="segment.kind">
              <option value="attack">Attack</option>
              <option value="sustain">Sustain</option>
              <option value="transition">Transition</option>
              <option value="release">Release</option>
              <option value="silence">Silence</option>
            </select>
          </label> -->
        </div>
      
        <!-- Display fields based on segment kind -->
        <div v-if="segment.kind === 'attack' || segment.kind === 'transition'">
          <!-- Editable fields for Attack and Transition -->
          <p>
            Start Time: {{ segment.start_time.toFixed(2) }} s
            <br>
            <!-- <input disabled type="range" v-model.number="segment.start_time" :min="0" :max="unitDuration" step="0.01"><br> -->
            End Time: {{ segment.end_time.toFixed(2) }} s
            <br><br>
            <!-- <input disabled type="range" v-model.number="segment.end_time" :min="segment.start_time" :max="unitDuration" step="0.01"><br> -->
            Start Frequency: {{ segment.start_frequency.toFixed(2) }} Hz
            <input
              type="range"
              v-model.number="segment.start_frequency"
              min="80"
              max="1000"
              step="1"
            ><br>
            End Frequency: {{ segment.end_frequency.toFixed(2) }} Hz
            <input
              type="range"
              v-model.number="segment.end_frequency"
              min="80"
              max="1000"
              step="1"
            ><br>
          </p>
        </div>

        <div v-else-if="segment.kind === 'sustain'">
          <!-- Editable fields for Sustain -->
          <p>
            Start Time: {{ segment.start_time.toFixed(2) }} s
            <br>
            <!-- <input disabled type="range" v-model.number="segment.start_time" :min="0" :max="unitDuration" step="0.01"><br> -->
            End Time: {{ segment.end_time.toFixed(2) }} s
            <br><br>
            <!-- <input disabled type="range" v-model.number="segment.end_time" :min="segment.start_time" :max="unitDuration" step="0.01"><br> -->
            Frequency: {{ segment.frequency.toFixed(2) }} Hz
            <input
              type="range"
              v-model.number="segment.frequency"
              min="80"
              max="1000"
              step="1"
            ><br>
            Vibrato Attack Duration: {{ segment.vib_attack_duration.toFixed(2) }} s
            <input type="range" v-model.number="segment.vib_attack_duration" min="0" :max="unitDuration" step="0.01"><br>
            Vibrato Release Duration: {{ segment.vib_release_duration.toFixed(2) }} s
            <input type="range" v-model.number="segment.vib_release_duration" min="0" :max="unitDuration" step="0.01"><br>
            Vibrato Frequency: {{ segment.vib_frequency.toFixed(1) }} Hz
            <input type="range" v-model.number="segment.vib_frequency" min="0" max="10" step="0.1"><br>
            Vibrato Amplitude: {{ segment.vib_amplitude }} Hz
            <input type="range" v-model.number="segment.vib_amplitude" min="0" max="100" step="1"><br>
          </p>
        </div>

        <div v-else-if="segment.kind === 'release' || segment.kind === 'silence'">
          <!-- Editable fields for Release and Silence -->
          <p>
            Start Time: {{ segment.start_time.toFixed(2) }} s
            <br>
            <!-- <input disabled type="range" v-model.number="segment.start_time" :min="0" :max="unitDuration" step="0.01"><br> -->
            End Time: {{ segment.end_time.toFixed(2) }} s
            <br><br>
            <!-- <input disabled type="range" v-model.number="segment.end_time" :min="segment.start_time" :max="unitDuration" step="0.01"><br> -->
          </p>
        </div>
      </div>

      <!-- Buttons to Add/Remove f₀ Segments -->
      <!-- <div class="segment-buttons">
        <button @click="addF0Segment">Add f₀ Segment</button>
        <button @click="removeLastF0Segment">Remove Last f₀ Segment</button>
      </div> -->
    </div>

    <!-- Loudness Information -->
    <div class="unit-info-block">
      <h3>Loudness</h3>
      <div
        v-for="(segment, index) in unit.loudness.segments"
        :key="'loudness-segment-' + index"
        class="segment-block"
      >
        <!-- Editable Segment Kind -->
        <div>
          <h4> {{ capitalize(segment.kind) }}</h4>
          <!-- <label>
            Kind:
            <select v-model="segment.kind">
              <option value="vowel">Vowel</option>
              <option value="loudnesssilence">Silence</option>
            </select>
          </label> -->
        </div>

        <div v-if="segment.kind === 'vowel'">
          <!-- Editable fields for Vowel -->
          <p>
            Start Time: {{ segment.start_time.toFixed(2) }} s
            <br>
            <!-- <input disabled type="range" v-model.number="segment.start_time" :min="0" :max="unitDuration" step="0.01"><br> -->
            End Time: {{ segment.end_time.toFixed(2) }} s
            <br><br>
            <!-- <input disabled type="range" v-model.number="segment.end_time" :min="segment.start_time" :max="unitDuration" step="0.01"><br> -->
            Scale Factor: {{ segment.scale_factor.toFixed(2) }}
            <input type="range" v-model.number="segment.scale_factor" min="0" max="2" step="0.01"><br>
            Accent Factor: {{ segment.accent_factor.toFixed(2) }}
            <input type="range" v-model.number="segment.accent_factor" min="0" max="2" step="0.01"><br>
            Attack Duration: {{ segment.attack_duration.toFixed(2) }} s
            <input type="range" v-model.number="segment.attack_duration" min="0" :max="unitDuration" step="0.01"><br>
            Release Duration: {{ segment.release_duration.toFixed(2) }} s
            <input type="range" v-model.number="segment.release_duration" min="0" :max="unitDuration" step="0.01"><br>
          </p>
        </div>

        <div v-else-if="segment.kind === 'loudnesssilence'">
          <!-- Editable fields for Silence -->
          <p>
            Start Time: {{ segment.start_time.toFixed(2) }} s
            <br>
            <!-- <input disabled type="range" v-model.number="segment.start_time" :min="0" :max="unitDuration" step="0.01"><br> -->
            End Time: {{ segment.end_time.toFixed(2) }} s
            <br><br>
            <!-- <input disabled type="range" v-model.number="segment.end_time" :min="segment.start_time" :max="unitDuration" step="0.01"><br> -->
          </p>
        </div>
      </div>

      <!-- Buttons to Add/Remove Loudness Segments -->
      <!-- <div class="segment-buttons">
        <button @click="addLoudnessSegment">Add Loudness Segment</button>
        <button @click="removeLastLoudnessSegment">Remove Last Loudness Segment</button>
      </div> -->
    </div>

    <!-- Note Information -->
    <div class="unit-info-block">
      <h3>Note</h3>
      <div class="segment-block">
        <p>
          MIDI Note: {{ unit.note.midi }}
          <input
            type="range"
            v-model.number="unit.note.midi"
            min="21"
            max="108"
            step="1"
          ><br>
          Tatums: {{ unit.note.num_tatums.toFixed(2) }}
          <input
            type="range"
            v-model.number="unit.note.num_tatums"
            min="0"
            max="10"
            step="0.01"
          ><br>
          Tempo: {{ unit.note.tempo }}
          <input
            type="range"
            v-model.number="unit.note.tempo"
            min="30"
            max="300"
            step="1"
          ><br>
          Velocity: {{ unit.note.velocity }}
          <br>
          <input
            type="range"
            v-model.number="unit.note.velocity"
            min="0"
            max="127"
            step="1"
          ><br>
        </p>
      </div>
    </div>
  </div>
  <div v-else class="metadata-container">
    <p>Select a unit to see the information.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Unit } from '../types';

interface Props {
  unit: Unit | null;
  unitIndex: number | null;
  dataName: string;
  totalDuration: number;
  tempo: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'add-unit'): void;
  (e: 'remove-unit'): void;
}>();

// Vowel options provided
const vowelOptions = [
  '_', 's', 'E', 't', 'y', 'n', 'S', 'a~', 'o~', 'k', 'i', 'u', 'R', '@',
  'b', 'l', 'w', 'a', 'm', 'e', 'Z', 'E'
];

// Helper functions and computed properties
function capitalize (str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function frequencyToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return 69 + 12 * Math.log2(freq / 440);
}

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const unitStartTime = computed(() => {
  if (props.unit && props.unit.f0.segments.length > 0) {
    return props.unit.f0.segments[0].start_time;
  }
  return 0;
});

const unitEndTime = computed(() => {
  if (props.unit && props.unit.f0.segments.length > 0) {
    return props.unit.f0.segments[props.unit.f0.segments.length - 1].end_time;
  }
  return 0;
});

const unitDuration = computed(() => {
  return unitEndTime.value - unitStartTime.value;
});

// For MIDI note editing
const segmentMidiNotes = ref<number[]>([]);

// Watch for changes in unit to initialize segmentMidiNotes
watch(
  () => props.unit,
  (newUnit) => {
    if (newUnit) {
      segmentMidiNotes.value = newUnit.f0.segments.map((segment) => {
        if (segment.kind === 'sustain') {
          return frequencyToMidi(segment.frequency);
        } else {
          return 0;
        }
      });
    }
  },
  { immediate: true, deep: true }
);

// Handler for MIDI note changes
const onMidiNoteChange = (index: number) => {
  if (props.unit) {
    const segment = props.unit.f0.segments[index];
    if (segment && segment.kind === 'sustain') {
      segment.frequency = midiToFrequency(segmentMidiNotes.value[index]);
    }
  }
};

// Methods to add/remove segments
const addF0Segment = () => {
  if (props.unit) {
    props.unit.f0.segments.push({
      kind: 'sustain',
      start_time: 0,
      end_time: 0,
      frequency: 440,
      vib_attack_duration: 0,
      vib_release_duration: 0,
      vib_frequency: 0,
      vib_amplitude: 0,
      vib_offset: 0,
    });
    // Update segmentMidiNotes
    segmentMidiNotes.value.push(frequencyToMidi(440));
  }
};

const removeLastF0Segment = () => {
  if (props.unit && props.unit.f0.segments.length > 0) {
    props.unit.f0.segments.pop();
    segmentMidiNotes.value.pop();
  }
};

const addLoudnessSegment = () => {
  if (props.unit) {
    props.unit.loudness.segments.push({
      kind: 'vowel',
      start_time: 0,
      end_time: 0,
      scale_factor: 1,
      accent_factor: 1,
      attack_duration: 0,
      release_duration: 0,
    });
  }
};

const removeLastLoudnessSegment = () => {
  if (props.unit && props.unit.loudness.segments.length > 0) {
    props.unit.loudness.segments.pop();
  }
};
</script>

<style scoped>
.metadata-container {
  overflow-y: auto;
  padding: 1rem;
  font-size: 14px;
}

.info-block, .unit-info-block {
  padding: 0.5rem;
  border: 1px solid #ccc;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-radius: 4px;
}

.info-block h3, .unit-info-block h3, .unit-info-block h4 {
  margin: 0;
}

.info-data {
  display: flex;
  flex-direction: column;
  text-align: left;
  margin-top: 0.5rem;
}

.info-data p {
  margin: 0;
}

.unit-info-block select {
  background-color: transparent;
  color: #000;
}

input[type="range"], input[type="text"] {
  /* max-width: 300px; */
  background-color: transparent;
  color: #000;
  margin-top: 0.5rem;
}

input[type="text"] {
  border: 1px solid #000;
  width: 100%;
  max-width: 70px;
}

input[type=range]{
  -webkit-appearance: none;
}

input[type=range]::-webkit-slider-runnable-track {
  /* width: 300px; */
  height: 5px;
  background: #ddd;
  border: none;
  border-radius: 3px;
}

input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  border: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #027bff;
  margin-top: -5px;
}

input[type=range]:focus {
  outline: none;
}

input[type=range]:focus::-webkit-slider-runnable-track {
  background: #ccc;
}

input[type="range"]:hover {
  cursor: pointer;
}

.unit-label {
  margin-left: 0.25rem;
  color: #555;
}

.button-group {
  margin-top: 1rem;
}

.button-group button {
  width: -webkit-fill-available;
  margin-right: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.button-group button:hover {
  background-color: #45a049;
}

.button-group button:not(:first-child) {
  margin-top: 1rem;
}

.segment-buttons {
  margin-top: 1rem;
}

.segment-buttons button {
  width: -webkit-fill-available;
  margin-right: 0.5rem;
  padding: 0.25rem 0.5rem;
  background-color: #2196F3;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.segment-buttons button:hover {
  background-color: #0b7dda;
}

.segment-buttons button:not(:first-child) {
  margin-top: 1rem;
}

.segment-block {
  border: 1px solid #ddd;
  padding: 0.5rem;
  margin-top: 0.5rem;
  border-radius: 4px;
}
</style>

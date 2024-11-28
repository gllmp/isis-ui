<!-- src/App.vue -->
<template>
  <div class="app-container">
    <div class="app-header">
      <h2 class="title">ISiS Viewer</h2>
      <!-- Import/Export Container -->
      <div class="import-export-container">
        <label for="jsonFile" class="import-label">Import JSON File:</label>
        <input 
          type="file" 
          id="jsonFile" 
          accept=".json" 
          @change="importJsonFile"
        />
        <button @click="exportToJson" class="export-button">Export to JSON</button>
      </div>
    </div>

    <div class="visualization-container">
      <!-- Graphs Container -->
      <div :class="['graphs-container', { 'full-width': !showMetadata }]">
        <F0Curve
          :data="data"
          :selectedUnit="selectedUnit"
          :highlightedUnit="highlightedUnit"
          @unit-selected="onUnitSelected"
          @unit-highlighted="onUnitHighlighted"
          @timings-updated="onTimingsUpdated"
        />
        <LoudnessCurve
          :data="data"
          :selectedUnit="selectedUnit"
          :highlightedUnit="highlightedUnit"
          @unit-selected="onUnitSelected"
          @unit-highlighted="onUnitHighlighted"
          @timings-updated="onTimingsUpdated"
        />
        <!-- MidiNoteCurve Component -->
        <MidiNoteCurve
          :data="data"
          :selectedUnit="selectedUnit"
          :highlightedUnit="highlightedUnit"
          @unit-selected="onUnitSelected"
          @unit-highlighted="onUnitHighlighted"
          @timings-updated="onTimingsUpdated"
        />
      </div>

      <!-- Metadata Container -->
      <div class="metadata-wrapper" v-if="showMetadata">
        <button @click="toggleMetadataVisibility" class="toggle-button">
          {{ showMetadata ? 'Hide Metadata' : 'Show Metadata' }}
        </button>
        <MetadataDisplay
          :unit="selectedUnit"
          :unitIndex="selectedUnitIndex"
          :dataName="data?.name || 'Unknown Data Name'" 
          :totalDuration="totalDuration" 
          :tempo="tempo"
          @vowel-updated="onVowelUpdated"
          @add-unit="addUnit"
          @remove-unit="removeUnit"
        />
      </div>

      <!-- Show the toggle button when metadata is hidden -->
      <button v-else @click="toggleMetadataVisibility" class="toggle-button">
        {{ showMetadata ? 'Hide Metadata' : 'Show Metadata' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import F0Curve from './components/F0Curve.vue';
import LoudnessCurve from './components/LoudnessCurve.vue';
import MidiNoteCurve from './components/MidiNoteCurve.vue';
import MetadataDisplay from './components/MetadataDisplay.vue';
import testData from '../public/test.json'; // Import the test.json file
import type { Data, Unit } from '../types';

const data = ref<Data | null>(null);
const selectedUnit = ref<Unit | null>(null);
const selectedUnitIndex = ref<number | null>(null);
const highlightedUnit = ref<Unit | null>(null);

const totalDuration = ref<number>(0);
const tempo = ref<number>(120); // Default tempo, can be updated from JSON data

// Control metadata visibility
const showMetadata = ref<boolean>(true);

const toggleMetadataVisibility = () => {
  showMetadata.value = !showMetadata.value;
};

// Preload the test JSON data by default
onMounted(() => {
  data.value = reactive(testData); // Make data reactive
  totalDuration.value = testData.duration || 0;
  tempo.value = testData.tempo || 120;
});

// Function to handle file import
const importJsonFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    try {
      const fileContent = await file.text();
      const jsonData = JSON.parse(fileContent);
      
      data.value = reactive(jsonData); // Set the imported JSON data
      selectedUnit.value = null; // Clear the selected unit on import
      selectedUnitIndex.value = null; // Reset the selected unit index

      // Update additional information based on the imported data
      totalDuration.value = jsonData.totalDuration || 0;
      tempo.value = jsonData.tempo || 120;
      
    } catch (error) {
      console.error('Error parsing JSON file:', error);
      alert('Invalid JSON file. Please check the file and try again.');
    }
  }
};

// Function to handle exporting to JSON
const exportToJson = () => {
  if (!data.value) {
    alert('No data to export.');
    return;
  }

  const jsonStr = JSON.stringify(data.value, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'exported-data.json';
  link.click();

  URL.revokeObjectURL(url);
};

// Function to handle unit selection
const onUnitSelected = (unit: Unit) => {
  selectedUnit.value = unit;
  selectedUnitIndex.value = data.value?.units.findIndex(u => u === unit) ?? null;
};

// Function to handle unit highlighting
const onUnitHighlighted = (unit: Unit | null) => {
  highlightedUnit.value = unit;
};

// Function to handle vowel updates
const onVowelUpdated = (updatedVowel: string) => {
  if (selectedUnit.value) {
    selectedUnit.value.vowel = updatedVowel;
  }
};

// Function to add a new unit after the selected unit
const addUnit = () => {
  if (data.value) {
    const defaultDuration = 1.0; // Default duration in seconds

    const newUnit: Unit = {
      vowel: 'a',
      f0: { segments: [
        {
          kind: 'sustain',
          start_time: 0,
          end_time: defaultDuration,
          frequency: 440,
          vib_attack_duration: 0.1,
          vib_release_duration: 0.1,
          vib_frequency: 5.0,
          vib_amplitude: 5.0,
          vib_offset: 0,
        }
      ] },
      loudness: { segments: [
        {
          kind: 'vowel',
          start_time: 0,
          end_time: defaultDuration,
          scale_factor: 1.0,
          accent_factor: 1.0,
          attack_duration: 0.1,
          release_duration: 0.1,
        }
      ] },
      note: {
        midi: 60,
        num_tatums: 1.0,
        tempo: tempo.value,
        velocity: 63
      },
    };

    const insertIndex = selectedUnitIndex.value !== null ? selectedUnitIndex.value + 1 : data.value.units.length;

    data.value.units.splice(insertIndex, 0, newUnit);
    selectedUnit.value = newUnit;
    selectedUnitIndex.value = insertIndex;

    // Recalculate timings
    recalculateTimings();
  }
};

// Function to recalculate start and end times
const recalculateTimings = () => {
  let cumulativeTime = 0;

  data.value?.units.forEach((unit) => {
    // Calculate the intended unit duration
    const unitDuration = unit.note.num_tatums * (60 / unit.note.tempo);

    // Compute the original total duration of f0 segments
    const f0Segments = unit.f0.segments;
    if (f0Segments.length === 0) {
      // If there are no f0 segments, skip to the next unit
      return;
    }

    const originalStartTime = f0Segments[0].start_time;
    const originalEndTime = f0Segments[f0Segments.length - 1].end_time;
    const originalTotalDuration = originalEndTime - originalStartTime;

    // Compute scaling factor
    const timeScaleFactor = unitDuration / originalTotalDuration;

    // Update f0 segments
    let segmentCumulativeTime = cumulativeTime;
    unit.f0.segments.forEach((seg) => {
      const segmentDuration = seg.end_time - seg.start_time;
      const newSegmentDuration = segmentDuration * timeScaleFactor;

      seg.start_time = segmentCumulativeTime;
      seg.end_time = segmentCumulativeTime + newSegmentDuration;

      segmentCumulativeTime += newSegmentDuration;
    });

    // Update loudness segments similarly
    const loudnessSegments = unit.loudness.segments;
    segmentCumulativeTime = cumulativeTime;
    loudnessSegments.forEach((seg) => {
      const segmentDuration = seg.end_time - seg.start_time;
      const newSegmentDuration = segmentDuration * timeScaleFactor;

      seg.start_time = segmentCumulativeTime;
      seg.end_time = segmentCumulativeTime + newSegmentDuration;

      segmentCumulativeTime += newSegmentDuration;
    });

    // Increment cumulative time by the intended unit duration
    cumulativeTime += unitDuration;

    // Update total duration
    totalDuration.value = cumulativeTime;

    if (data.value) {
      data.value.duration = cumulativeTime;
    }
  });
};

// Function to remove the selected unit
const removeUnit = () => {
  if (data.value && selectedUnitIndex.value !== null) {
    if (confirm('Are you sure you want to remove this phoneme?')) {
      data.value.units.splice(selectedUnitIndex.value, 1);
      selectedUnit.value = null;
      selectedUnitIndex.value = null;

      // Recalculate timings
      recalculateTimings();
    }
  }
};

// Function to handle timings updated from child components
const onTimingsUpdated = () => {
  if (data.value) {
    const lastUnit = data.value.units[data.value.units.length - 1];
    if (lastUnit && lastUnit.loudness.segments.length > 0) {
      const lastSegment = lastUnit.loudness.segments[lastUnit.loudness.segments.length - 1];
      totalDuration.value = lastSegment.end_time;
      data.value.duration = lastSegment.end_time;
    }
  }
};
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  background-color: #f9f9f9;
  color: #333;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}

.app-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-left: 2rem;
  margin-right: 2rem;
}

.title {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.import-export-container {
  display: flex;
  justify-content: left;
  margin-top: 0.5rem;
  padding-left: 2rem;
}

.export-button {
  font-size: 14px;
}

.visualization-container {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex-wrap: nowrap;
  max-width: 100%;
  margin-top: 1rem;
}

.graphs-container {
  flex: 1 1 auto;
  min-width: 600px;
  margin-right: 1rem;
  transition: width 0.3s ease;
}

.graphs-container.full-width {
  max-width: 100%;
  margin-right: 0;
}

.graphs-container svg:nth-child(1) {
  position: relative;
  top: 0px;
}

.graphs-container svg:nth-child(2) {
  position: relative;
  top: -20px;
}

.graphs-container svg:nth-child(3) {
  position: relative;
  top: -20px;
}

.toggle-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toggle-button:hover {
  background-color: #0056b3;
}

.visualization-container {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex-wrap: nowrap;
  max-width: 100%; 
  margin-right: 2rem;
}

.graphs-container {
  flex: 1 1 auto;
  min-width: 600px;
  max-width: 80%;
  margin-right: 1rem;
}

.metadata-wrapper {
  display: flex;
  flex-direction: column;
  min-width: 285px;
  max-height: 750px;
  position: relative;
  top: -20px;
  text-align: left;
  overflow: scroll;
}

::-webkit-scrollbar {
  -webkit-appearance: none;
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-thumb {
  border-radius: 5px;
  background-color: rgba(0,0,0,.5);
  -webkit-box-shadow: 0 0 1px rgba(255,255,255,.5);
}

.metadata-container {
  /* max-height: 80vh; */
  overflow-y: auto;
  padding: 1rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.1);
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .visualization-container {
    flex-direction: column;
  }
  .graphs-container,
  .metadata-container {
    flex: 1 1 100%;
    margin-right: 0;
    margin-bottom: 1rem;
    width: auto;
    max-width: none;
  }
}
</style>

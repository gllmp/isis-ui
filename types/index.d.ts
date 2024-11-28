// src/types/index.d.ts

export interface Segment {
 kind: string;
 start_time: number;
 end_time: number;
 // Other properties depending on the segment kind
 [key: string]: any;
}

export interface F0Segment extends Segment {
 // Specific properties for F0 segments
 start_frequency?: number;
 end_frequency?: number;
 frequency?: number;
 vib_attack_duration?: number;
 vib_release_duration?: number;
 vib_frequency?: number;
 vib_amplitude?: number;
 vib_offset?: number;
}

export interface LoudnessSegment extends Segment {
 // Specific properties for loudness segments
 attack_duration?: number;
 release_duration?: number;
 scale_factor?: number;
 accent_factor?: number;
}

export interface Note {
  midi: number; // MIDI note number
  num_tatums: number; // Tatums for rhythmic structure
  tempo: number; // Tempo of the note in BPM
  velocity: number; // Velocity of the note
}

export interface Unit {
  vowel: string;
  f0: {
    segments: F0Segment[];
  };
  loudness: {
    segments: LoudnessSegment[];
  };
  note: Note;
}

export interface Data {
 units: Unit[];
}


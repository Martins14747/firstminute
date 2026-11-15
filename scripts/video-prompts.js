// Curated video-generation prompts for each emergency in FirstMinute.
// Design principles:
//   - Clinical / instructional tone, calm and clear
//   - Use training manikins, clean diagrams, or hands-only demos — NO real gore, NO blood, NO graphic injuries
//   - Camera: steady medium shot, well-lit, plain background
//   - Focus on the physical ACTIONS a layperson must perform, so the video teaches by showing
//   - 5 seconds, 1280x720, no audio (we add captions in the UI)
// Each prompt is short and self-contained (the model does best with focused, single-action prompts).

export const VIDEO_PROMPTS = {
  cpr: "Close-up demonstration on a CPR training manikin on the floor: hands placing the heel of one hand in the centre of the chest, other hand on top, interlocking fingers, arms straight, shoulders directly over the hands, then pushing down firmly and releasing in a steady rhythm, calm clinical setting, even lighting, instructional first-aid video.",

  bleeding: "Close-up demonstration on a clean training arm prop: a hand pressing a folded clean cloth firmly over a wound area on the forearm and holding steady pressure, then wrapping gauze around it, calm clinical setting, plain background, instructional first-aid video, no blood shown.",

  burns: "Close-up demonstration on a clean training hand prop: holding the hand under a steady stream of cool running water from a tap for several seconds, then gently patting dry with a clean cloth, calm clinical setting, instructional first-aid video.",

  head: "Demonstration with a person lying on the floor and a rescuer kneeling beside them: rescuer gently tilting the person's head and supporting the neck, keeping them still, one hand on the forehead and one supporting the neck, calm clinical setting, instructional first-aid video.",

  fracture: "Close-up demonstration on a clean training arm prop: hands gently immobilising an injured forearm by placing soft padded cloth around it and wrapping a rigid rolled magazine alongside as a splint, then tying it loosely, calm clinical setting, instructional first-aid video.",

  poisoning: "Demonstration of a person sitting upright and calm while a rescuer holds a product bottle to read the label, then reaching for a phone to call for help, plain indoor background, instructional first-aid video, no vomiting shown.",

  snake: "Close-up demonstration on a clean training leg prop: a rescuer calmly positioning the person to lie still, wrapping a broad clean cloth loosely a few centimetres above a bite mark area on the lower leg as a pressure bandage, calm clinical setting, instructional first-aid video, no graphic wound.",

  scorpion: "Demonstration of a rescuer helping a person sit calmly, then holding a cool wet cloth gently against the back of the hand where a sting is, keeping the person still, plain indoor background, instructional first-aid video.",

  choking: "Demonstration with two people standing: rescuer standing behind the person, wrapping arms around the waist, making a fist with one hand placed just above the navel, other hand over the fist, then delivering a quick inward and upward thrust, calm clinical setting, instructional first-aid video.",

  heat: "Demonstration of two people: a rescuer helping a person move into the shade, then fanning them with a cloth, lifting the person's legs slightly, and offering small sips of water, plain outdoor-to-shade transition, instructional first-aid video.",

  stroke: "Demonstration with a person sitting and a rescuer kneeling in front: rescuer asking the person to smile, then to raise both arms, then speaking a simple sentence, observing their face and arms, calm clinical setting, instructional first-aid video.",

  seizure: "Demonstration of a rescuer gently guiding a person having a seizure onto their side on the floor, clearing the area around them, placing a soft folded cloth under the head, and timing with a watch, calm clinical setting, instructional first-aid video."
};

// Friendly captions shown under each video in the UI
export const VIDEO_CAPTIONS = {
  cpr: "CPR compressions — hand position, depth, and rhythm on a training manikin.",
  bleeding: "Applying firm direct pressure and bandaging a wound on a training arm.",
  burns: "Cooling a burn under running water, then patting dry.",
  head: "Keeping a head-injury victim still and supporting the neck.",
  fracture: "Splinting a suspected fracture with a rolled cloth and magazine.",
  poisoning: "Reading the product label and calling for help — do not induce vomiting.",
  snake: "Lying still and applying a pressure-immobilisation bandage.",
  scorpion: "Keeping calm, staying still, and cooling the sting site.",
  choking: "Heimlich manoeuvre — hand position and upward thrusts.",
  heat: "Moving to shade, fanning, lifting legs, and small sips of water.",
  stroke: "FAST check — Face, Arms, Speech, Time.",
  seizure: "Rolling onto the side, clearing the area, cushioning the head."
};

export const VIDEO_IDS = Object.keys(VIDEO_PROMPTS);

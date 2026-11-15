// data/emergencies.js — The 12 emergency first-aid protocols.
// Single source of truth: served to the frontend via /api/emergencies
// and used by the doctor route for context.

export const EMERGENCIES = [
  {
    id: 'cpr', icon: '🫀', name: 'Cardiac Arrest / CPR', sev: 'high', cls: 'severe',
    tags: ['cpr', 'cardiac', 'heart', 'collapse', 'not breathing', 'unconscious', 'no pulse', 'drown'],
    what: 'The person has collapsed, is unresponsive and is not breathing normally. Brain damage can start within 4 minutes without help.',
    danger: 'Call 112 IMMEDIATELY and ask for an ambulance with an AED (defibrillator). Then start CPR.',
    steps: [
      { t: 'Check for danger and response', d: 'Make sure the scene is safe (traffic, fire, electricity). Tap the shoulders and shout "Are you OK?". No response = start now.' },
      { t: 'Call 112 & get an AED', d: 'If someone is with you, send them to call 112 and find a defibrillator (AED). If you are alone, call 112, put the phone on speaker, and start CPR.' },
      { t: 'Open the airway', d: 'Tilt the head back gently and lift the chin. Look in the mouth — if there is obvious vomit or an object, sweep it out with a finger.' },
      { t: 'Check breathing (10 sec max)', d: 'Look at the chest for movement, listen and feel for breath. Occasional gasps do NOT count as breathing. If not breathing normally, start CPR.' },
      { t: 'Start chest compressions', d: 'Place the heel of one hand in the centre of the chest (lower breastbone), other hand on top, interlock fingers. Push down 5–6 cm, 100–120 per minute. Let the chest come all the way back up between compressions.' },
      { t: 'Give 2 rescue breaths (if trained)', d: 'After 30 compressions, pinch the nose, seal your mouth over theirs, and blow steadily for 1 second each. Watch the chest rise. If untrained or unwilling, do hands-only CPR (just keep compressing).' },
      { t: 'Keep going', d: 'Continue 30 compressions : 2 breaths until: the person breathes normally, an AED arrives, or help takes over. Use the CPR Assistant below for the rhythm.' },
      { t: 'Use an AED if available', d: 'Turn it on and follow the spoken instructions. It is safe to use on a wet chest — just dry it quickly first. Do not touch the person when it is shocking.' },
    ],
    alts: [
      { need: 'No CPR mask for rescue breaths', use: 'Hands-only CPR is just as effective for the first minutes. Keep compressing — do not stop to look for a mask.' },
      { need: 'Nothing to harden the surface', use: 'CPR on a bed is less effective. If you cannot move them, slide a board, tray or folded cloth under the upper back. A firm floor is best.' },
      { need: 'No timer', use: 'Use the CPR Assistant in this app — it counts compressions, cycles and time.' },
    ],
    cta: true,
  },
  {
    id: 'bleeding', icon: '🩸', name: 'Cuts & Bleeding', sev: 'med', cls: 'warn',
    tags: ['bleeding', 'cut', 'wound', 'blood', 'laceration', 'deep cut', 'amputation'],
    what: 'Bleeding from a cut, wound or injury. Heavy bleeding can be life-threatening within minutes.',
    danger: 'Call 112 if: blood is spurting; you cannot stop it after 10 minutes of firm pressure; the wound is very deep, on the neck or chest; or a body part is amputated.',
    steps: [
      { t: 'Protect yourself', d: 'Wash your hands or wear gloves if available. This protects you and the patient from infection.' },
      { t: 'Apply firm pressure', d: 'Use a clean cloth, gauze or clothing and press firmly directly on the wound. Do not lift to check — keep pressing.' },
      { t: 'Add layers, do not remove', d: 'If the cloth soaks through, add more on top. Removing the first cloth pulls away the clot that is forming.' },
      { t: 'Keep the limb raised', d: 'If a limb is bleeding, raise it above the level of the heart once the wound is covered. This slows the flow.' },
      { t: 'Bandage firmly', d: 'Once bleeding eases, wrap a bandage or strip of cloth firmly over the dressing to hold it in place. Not so tight that fingers go blue or numb.' },
      { t: 'Treat for shock', d: 'Lay the person down and raise their legs if they feel faint, pale or cold. Keep them warm and calm. Do not give food or drink.' },
      { t: 'For amputation', d: 'Find the body part, rinse gently, wrap in clean cloth, put in a sealed plastic bag, then place that bag in ice water. Bring it to hospital with the patient.' },
    ],
    alts: [
      { need: 'No sterile gauze', use: 'Use any clean cotton cloth — a freshly washed T-shirt, wrapper, or clean tissue. Clean cloth is far better than nothing.' },
      { need: 'No bandage', use: 'Tie a strip of cloth, a folded gele / wrapper, or even a clean shoelace. Pressure on the dressing matters more than the material.' },
      { need: 'No gloves', use: 'Use a clean plastic bag over your hands. Wash thoroughly afterwards.' },
      { need: 'No ice for amputated part', use: 'Keep it cool with wet cloth — do NOT put the part directly on ice or in water. Keep it dry inside a sealed bag.' },
    ],
  },
  {
    id: 'burns', icon: '🔥', name: 'Burns & Scalds', sev: 'med', cls: 'warn',
    tags: ['burn', 'scald', 'fire', 'hot water', 'steam', 'boil', 'flame', 'chemical'],
    what: 'Skin damaged by heat (fire, hot water, steam), electricity or chemicals.',
    danger: 'Call 112 for: burns larger than the palm of the hand, burns to the face, hands, feet, groin, or airway, chemical burns, electrical burns, or burns to a child or elderly person.',
    steps: [
      { t: 'Stop the burning', d: 'Move the person away from the source. If clothes are on fire, drop and roll or smother with a heavy cloth. Switch off electricity for electrical burns.' },
      { t: 'Cool with running water', d: 'Hold the burn under cool (not ice-cold) running water for at least 20 minutes. This stops the burn going deeper and eases pain. Do this within 3 hours of the burn.' },
      { t: 'Remove tight items', d: 'Gently remove rings, watches, belts and tight clothing near the burn BEFORE it swells. Do not pull off anything stuck to the skin.' },
      { t: 'Do NOT apply toothpaste, palm oil, eggs or flour', d: 'These old remedies trap heat and cause infection. Only cool water and a clean covering.' },
      { t: 'Cover loosely', d: 'After cooling, cover with cling film (not tight) or a clean non-fluffy cloth. This protects the skin and reduces pain.' },
      { t: 'Give water to drink if conscious', d: 'Small sips of clean water help if the burn is large. Do not give alcohol.' },
      { t: 'For chemical burns', d: 'Brush off dry chemicals first, then flood with cool running water for at least 20 minutes. Remove contaminated clothing carefully.' },
    ],
    alts: [
      { need: 'No running water', use: 'Soak a clean cloth in cool water and lay it over the burn, re-wetting often. Any clean cool water source — bowl, bottle, jerrycan — works.' },
      { need: 'No cling film', use: 'Use a clean, non-fluffy cloth or a freshly washed pillowcase. Avoid cotton wool or anything that sheds fibres.' },
      { need: 'No running water for chemicals', use: 'Pour large amounts of any clean water over the area for a long time. The volume of water matters more than the source.' },
    ],
  },
  {
    id: 'head', icon: '🤕', name: 'Head Injury', sev: 'high', cls: 'severe',
    tags: ['head', 'skull', 'concussion', 'hit head', 'fell on head', 'unconscious after fall'],
    what: 'A blow to the head. Even without visible bleeding, the brain can be injured.',
    danger: 'Call 112 immediately if the person: lost consciousness, vomits more than once, has a seizure, cannot remember the injury, complains of severe headache, has unequal pupils, or fluid/blood from nose or ears.',
    steps: [
      { t: 'Check response and breathing', d: 'If not responsive and not breathing normally, start CPR. If responsive, keep them still.' },
      { t: 'Keep the head and neck still', d: 'Do not move the person if you suspect neck injury. Hold the head in the position you found it.' },
      { t: 'Apply cold compress', d: 'For a bump, hold a cold wet cloth or ice wrapped in cloth on the area for 15–20 minutes. Do not put ice directly on skin.' },
      { t: 'Control any bleeding', d: 'Press firmly with a clean cloth on any scalp wound. The scalp bleeds a lot — pressure usually stops it.' },
      { t: 'Do not clean deep wounds', d: 'Do not probe or push anything into a deep head wound. Cover it lightly and seek care.' },
      { t: 'Watch for danger signs', d: 'For the next 24 hours, watch for: worsening headache, repeated vomiting, confusion, slurred speech, weakness in arms/legs, drowsiness, fits. Any of these = go to hospital now.' },
      { t: 'Rest and no alcohol', d: 'Rest for 24–48 hours. No alcohol, no strenuous activity. An adult should check on the person every couple of hours through the night.' },
    ],
    alts: [
      { need: 'No ice pack', use: 'A cloth soaked in cool water, a cold bottle, or frozen food wrapped in cloth all work. Apply for 15–20 minutes.' },
      { need: 'No clean dressing for scalp wound', use: 'Use any clean cloth. The scalp bleeds heavily — firm pressure for 10 minutes usually controls it.' },
      { need: 'No one to watch at night', use: 'Do not leave the person alone. If nobody can wake them every 2 hours, take them to hospital for observation.' },
    ],
  },
  {
    id: 'fracture', icon: '🦴', name: 'Falls & Fractures', sev: 'med', cls: 'warn',
    tags: ['fracture', 'broken bone', 'fall', 'sprain', 'twisted', 'dislocation', 'cannot move limb'],
    what: 'A broken or cracked bone, or a bad sprain, often from a fall. It can be hard to tell a break from a sprain without an X-ray.',
    danger: 'Call 112 if: the bone is visible or poking out, the limb looks bent or twisted, the person cannot move, or the injury is to the neck, back, hip or thigh.',
    steps: [
      { t: 'Keep the person still', d: 'Do not move them if you suspect a spine, neck, hip or thigh injury unless they are in immediate danger. Support the injured part as found.' },
      { t: 'Control any bleeding', d: 'If bone is visible or there is a wound, press around (not on) the wound with a clean cloth. Do not push the bone back in.' },
      { t: 'Immobilise the limb', d: 'Keep it in the position you found it. Pad around it with cloth and support with a rolled newspaper, stick or board tied gently above and below the break.' },
      { t: 'Apply cold', d: 'A cold wet cloth or ice wrapped in cloth on the area for 15–20 minutes reduces swelling and pain.' },
      { t: 'Raise the limb if possible', d: 'If it does not cause more pain and you are sure it is not a spine/neck injury, raise the injured limb above the heart.' },
      { t: 'Treat for shock', d: 'Keep the person warm and calm. Lay them down and raise legs if they feel faint.' },
      { t: 'Get to hospital', d: 'All suspected fractures need an X-ray. Move the person carefully — splint first, then transport.' },
    ],
    alts: [
      { need: 'No splint', use: 'Roll a newspaper, magazine, or stick and pad with cloth. Tie above AND below the break with strips of cloth, not tightly.' },
      { need: 'No bandage', use: 'Use strips of cloth — a torn wrapper, scarf or shoelace. Tie firmly enough to hold the limb still, but not so tight fingers go blue.' },
      { need: 'No ice', use: 'A cloth soaked in cool water works. Avoid very cold items directly on swollen skin.' },
      { need: 'No rigid support for arm', use: 'Tuck the arm into a folded cloth sling against the body — the body itself becomes the splint.' },
    ],
  },
  {
    id: 'poisoning', icon: '☠️', name: 'Poisoning', sev: 'high', cls: 'severe',
    tags: ['poison', 'swallow', 'drank', 'kerosene', 'bleach', 'detergent', 'tablet', 'overdose', 'insecticide', 'rat poison'],
    what: 'Swallowing, breathing in or absorbing something harmful — kerosene, bleach, detergent, rat poison, insecticide, wrong tablets, or overdose.',
    danger: 'Call 112 OR the nearest Poison Centre IMMEDIATELY. Do NOT make the person vomit unless told to by a professional. Take the container/bottle to hospital.',
    steps: [
      { t: 'Make the scene safe', d: 'Move the person away from the source (e.g. out of a room with fumes). Do not put yourself at risk.' },
      { t: 'Call 112 / Poison Centre', d: 'In Nigeria, call 112. If the product is known, take the bottle/label with you. If a Poison Centre is available, call them.' },
      { t: 'Wipe the mouth', d: 'Wipe out any remaining substance from the mouth with a cloth. Do NOT rinse heavily in case they inhale it.' },
      { t: 'Do NOT induce vomiting', d: 'This is critical: do NOT give salt water, do NOT put fingers down the throat. For kerosene, fuel and corrosives, vomiting causes MORE damage to the lungs and throat.' },
      { t: 'Do NOT give milk or water (yet)', d: 'Only give fluids if a Poison Centre or doctor tells you to. The wrong fluid can speed up absorption of some poisons.' },
      { t: 'Keep the container', d: 'Bring the bottle, wrapper, leaves or tablets to the hospital. This is the most useful thing you can do.' },
      { t: 'If unconscious but breathing', d: 'Place in the recovery position (on their side) and watch breathing. Be ready to start CPR.' },
    ],
    alts: [
      { need: 'Cannot reach 112', use: 'Go straight to the nearest Teaching Hospital or Federal Medical Centre with the container. Do not wait.' },
      { need: 'Chemical on skin', use: 'Remove contaminated clothing and flood the skin with cool running water for 15–20 minutes.' },
      { need: 'Poison in the eyes', use: 'Rinse the eye gently with clean cool water for at least 15 minutes, eyelids open. Then go to hospital.' },
      { need: 'Inhaled poison (fumes, generator smoke, gas)', use: 'Move the person to fresh air immediately. If not breathing, start CPR after moving to safety.' },
    ],
  },
  {
    id: 'snake', icon: '🐍', name: 'Snake Bite', sev: 'high', cls: 'severe',
    tags: ['snake', 'bite', 'snakebite', 'python', 'cobra', 'viper', 'fang'],
    what: 'Bite from a snake. Some Nigerian snakes (carpet viper, cobra, puff adder) are venomous and need urgent treatment with antivenom.',
    danger: 'Go to hospital IMMEDIATELY — even if you feel fine at first. Antivenom works best early. Call 112 or arrange urgent transport.',
    steps: [
      { t: 'Move away from the snake', d: 'Step back calmly. Do not chase or try to kill the snake — a second bite is worse.' },
      { t: 'Keep the person calm and still', d: 'Movement spreads venom faster. Sit or lie down with the bitten limb below heart level if possible.' },
      { t: 'Remove tight items', d: 'Take off rings, watches, shoes and tight clothing near the bite — swelling will follow.' },
      { t: 'Wash gently with water', d: 'Rinse the bite with clean water and soap. Do not rub or cut the wound.' },
      { t: 'Immobilise the limb', d: 'Splint the bitten limb as for a fracture, loosely. Keep it still. The less movement, the slower the venom spreads.' },
      { t: 'Do NOT cut, suck, or apply a tourniquet', d: 'These old methods cause more harm — tissue damage, infection, and they do not stop venom. Modern guidelines are against them.' },
      { t: 'Note the time and symptoms', d: 'Write down the time of the bite and watch for: swelling, bleeding gums, drooping eyelids, difficulty breathing, drowsiness. Tell the hospital all of this.' },
      { t: 'Get to hospital fast', d: 'Antivenom is the only specific treatment. Carry the person if possible. Do not let them walk.' },
    ],
    alts: [
      { need: 'No splint', use: 'Roll a newspaper, stick or piece of cloth around the limb. Movement spreads venom — keeping still is the priority.' },
      { need: 'No transport', use: 'Carry the person on a chair, plank or stretcher. Avoid them walking. Bystanders will usually help.' },
      { need: 'No phone to call ahead', use: 'Send someone ahead to warn the hospital so antivenom can be prepared. Note the bite time and symptoms on paper.' },
      { need: 'Do not know the snake', use: 'Do NOT try to catch it. A photo from a safe distance helps doctors — but treatment is based on symptoms, not the snake type.' },
    ],
  },
  {
    id: 'scorpion', icon: '🦂', name: 'Scorpion Sting', sev: 'med', cls: 'warn',
    tags: ['scorpion', 'sting', 'stung', 'venom', 'insect sting', 'wasp', 'bee'],
    what: 'Sting from a scorpion or stinging insect. Most are painful but not dangerous; some Nigerian scorpions can cause serious symptoms.',
    danger: 'Go to hospital if: the person is a child, the sting is on the face or neck, or there is difficulty breathing, drooling, sweating, twitching, vomiting or drowsiness.',
    steps: [
      { t: 'Move to safety', d: 'Step away from the scorpion. If you can safely kill or trap it, do — but do not risk a second sting.' },
      { t: 'Wash the sting with soap and water', d: 'Clean the area gently to remove venom on the skin.' },
      { t: 'Apply a cold compress', d: 'Ice or a cold wet cloth wrapped in cloth, on the sting for 10–15 minutes. This eases pain and slows venom.' },
      { t: 'Keep the limb still and raised', d: 'Movement spreads venom. Keep the bitten limb still, ideally raised above heart level.' },
      { t: 'Give simple pain relief', d: 'Paracetamol helps pain. Do NOT give aspirin or ibuprofen — they may worsen bleeding with some stings.' },
      { t: 'Watch for danger signs', d: 'Look out for: drooling, sweating, blurred vision, muscle twitching, difficulty breathing, vomiting — especially in children. Go to hospital immediately.' },
      { t: 'Do NOT cut or suck the sting', d: 'Do not try to suck out venom or cut the wound. It does not help and causes infection.' },
    ],
    alts: [
      { need: 'No ice', use: 'Cloth soaked in cool water, a cold bottle, or wet mud wrapped in cloth. Apply for 10–15 minutes.' },
      { need: 'No paracetamol', use: 'A cold compress and rest are the main treatment. Avoid home brews — alcohol and local mixtures can worsen symptoms.' },
      { need: 'Bee sting with stinger left in', use: 'Scrape the stinger out sideways with a card or fingernail. Do not squeeze with tweezers — that pushes more venom in.' },
    ],
  },
  {
    id: 'choking', icon: '😮‍💨', name: 'Choking', sev: 'high', cls: 'severe',
    tags: ['choking', 'choked', 'cannot breathe', 'food stuck', 'object in throat', 'clutching throat'],
    what: 'Something is blocking the airway — usually food. The person cannot speak, cough or breathe.',
    danger: 'Act FAST — brain damage starts within minutes. If they become unconscious, call 112 and start CPR.',
    steps: [
      { t: 'Ask "Are you choking?"', d: 'If they can cough, encourage them to cough hard. Do not interfere. If they cannot speak, cough or breathe — act now.' },
      { t: 'Lean them forward', d: 'Bend the person forward at the waist. Support the chest with one hand.' },
      { t: 'Give 5 back blows', d: 'With the heel of your hand, give up to 5 firm blows between the shoulder blades. Check the mouth after each.' },
      { t: 'Give 5 abdominal thrusts (Heimlich)', d: 'Stand behind, place a fist above the navel, grasp with the other hand, and pull sharply in and up. Repeat up to 5 times.' },
      { t: 'Alternate back blows and thrusts', d: 'Keep alternating 5 back blows and 5 thrusts until the object comes out or they collapse.' },
      { t: 'If they become unconscious', d: 'Call 112. Lower them carefully to the ground, start CPR. Each time you open the airway, check the mouth and remove any object you can see.' },
      { t: 'See a doctor afterwards', d: 'Even if the object comes out, abdominal thrusts can cause internal injury. Get checked at a hospital.' },
    ],
    alts: [
      { need: 'Person is alone and choking', d: 'Make a fist above your navel, or press your upper abdomen over the back of a chair, and thrust in and up.' },
      { need: 'Person is obese or pregnant', d: 'Use chest thrusts instead: place your hands in the centre of the chest (as for CPR) and push sharply.' },
      { need: 'Infant under 1 year', d: 'Hold face-down along your forearm, head lower than chest. Give 5 back blows. Turn face-up, give 5 chest thrusts with two fingers. Never do abdominal thrusts on a baby.' },
      { need: 'No phone to call 112', d: 'Shout to attract help. Bystanders can call. Keep doing back blows and thrusts.' },
    ],
  },
  {
    id: 'heat', icon: '🌡️', name: 'Heat Stroke', sev: 'high', cls: 'severe',
    tags: ['heat', 'sun', 'hot', 'dehydration', 'fainted', 'heatstroke', 'overheated', 'heat exhaustion'],
    what: "Body overheating, common in Nigeria's hot season. Heat exhaustion is mild; heat stroke (confusion, no sweat, very high temperature) is a medical emergency.",
    danger: 'Call 112 if the person is confused, unconscious, has a fit, stops sweating despite the heat, or has a very high temperature.',
    steps: [
      { t: 'Move to a cool place', d: 'Get the person into shade or a cool room. Lie them down with legs raised.' },
      { t: 'Remove excess clothing', d: 'Loosen or remove tight and heavy clothing to help cooling.' },
      { t: 'Cool the body', d: 'Fan them and sponge with cool water. Pay special attention to neck, armpits and groin. A wet cloth on these areas cools fastest.' },
      { t: 'Give fluids if conscious', d: 'Small sips of clean water or ORS (oral rehydration salts). Do not give alcohol or very sweet drinks.' },
      { t: 'Watch for heat stroke', d: 'If confused, hot but dry, unconscious, or fitting — this is heat stroke. Call 112. Cool aggressively with water and fanning while waiting.' },
      { t: 'Do not use ice baths carelessly', d: 'Very cold immersion can be dangerous for the elderly. Use cool (not ice) water and fanning for them.' },
      { t: 'Rest afterwards', d: 'Even after recovery, rest for 24 hours. Avoid sun and heavy work. Drink extra fluids.' },
    ],
    alts: [
      { need: 'No ORS sachet', use: 'Mix 1 litre of clean water with 6 level teaspoons of sugar and half a teaspoon of salt. This homemade ORS saves lives.' },
      { need: 'No air conditioning', use: 'A wet cloth on neck, armpits and groin plus hand fanning works well. Move to the coolest, shadiest spot available.' },
      { need: 'No fan', use: 'Any flat object — carton, tray, cloth — moved back and forth creates airflow. Keep the wet cloth on.' },
      { need: 'No thermometer', use: 'Treat by symptoms: hot, dry, red skin with confusion or unconsciousness = heat stroke. Cool them now.' },
    ],
  },
  {
    id: 'stroke', icon: '🧠', name: 'Stroke', sev: 'high', cls: 'severe',
    tags: ['stroke', 'face drooping', 'slurred speech', 'weak arm', 'brain', 'FAST', 'paralysis'],
    what: 'A block or bleed in the brain. The faster the person reaches hospital, the more brain can be saved.',
    danger: 'Call 112 IMMEDIATELY. Note the time symptoms started. Treatment is most effective within 3–4 hours.',
    steps: [
      { t: 'Do the FAST check', d: 'F = Face: ask them to smile — does one side droop? A = Arms: can they raise both and keep them up? S = Speech: is their speech slurred or odd? T = Time: call 112 now.' },
      { t: 'Call 112 immediately', d: 'Say "I think this is a stroke". Tell them the time symptoms started — this is the single most important fact for treatment.' },
      { t: 'Keep them comfortable', d: 'Help them sit or lie with head and shoulders slightly raised. Do not move them more than needed.' },
      { t: 'Loosen tight clothing', d: 'Undo collar, ties, belts to ease breathing.' },
      { t: 'Do NOT give food, drink or medicine', d: 'Stroke can affect swallowing. Giving anything by mouth risks choking. Wait for medical help.' },
      { t: 'Watch breathing', d: 'If they become unconscious, check breathing. If not breathing normally, start CPR.' },
      { t: 'Reassure and stay', d: 'Stay with them, keep them calm. Note any change in symptoms and tell the hospital.' },
    ],
    alts: [
      { need: 'Cannot reach 112', use: 'Get to the nearest Teaching Hospital with a CT scanner as fast as possible. Time is brain — every minute matters.' },
      { need: 'No transport', use: 'Ask neighbours, a church/mosque vehicle, or a taxi. Stroke is an emergency — most people will help.' },
      { need: 'Not sure it is a stroke', use: 'If any FAST sign is present, treat it as a stroke. It is far better to be wrong than to delay.' },
    ],
  },
  {
    id: 'seizure', icon: '🌀', name: 'Seizure / Convulsion', sev: 'med', cls: 'warn',
    tags: ['seizure', 'convulsion', 'fit', 'epilepsy', 'shaking', 'jerking', 'febrile convulsion', 'child fitting'],
    what: 'Sudden uncontrolled body movements, often with loss of awareness. In children it is often caused by high fever.',
    danger: 'Call 112 if: the seizure lasts more than 5 minutes, it is a first seizure, the person is injured, pregnant, or has another seizure without waking up.',
    steps: [
      { t: 'Keep them safe — clear the area', d: 'Move furniture and hard objects away. Do not restrain them or hold them down.' },
      { t: 'Cushion the head', d: 'Place something soft (folded cloth, jacket) under the head. Do not move them unless in danger.' },
      { t: 'Do NOT put anything in the mouth', d: 'Never put a spoon, finger or object in the mouth. People cannot "swallow their tongue" — but they can break teeth or choke.' },
      { t: 'Time the seizure', d: 'Note when it starts. If it lasts more than 5 minutes, call 112.' },
      { t: 'Turn on their side once jerking stops', d: 'This is the recovery position — it keeps the airway open and lets fluids drain. Loosen tight clothing around the neck.' },
      { t: 'Stay until fully awake', d: 'Reassure them as they come round. They may be confused and tired for some minutes.' },
      { t: 'For a febrile child', d: 'Remove excess clothing, sponge with lukewarm (not cold) water, and seek medical care. Do NOT rub or use harsh remedies.' },
    ],
    alts: [
      { need: 'No soft item for the head', use: 'Fold a wrapper, shirt, or any cloth and place under the head. The aim is just to cushion.' },
      { need: 'Child with high fever', use: 'Lukewarm sponging (NOT cold water or ice — that causes shivering and raises temperature) and remove heavy clothing. Then go to hospital.' },
      { need: 'Seizure in water (e.g. bath)', use: 'Get the head out of the water immediately, support the face up, and call 112. Drowning is the main danger.' },
    ],
  },
];

export const EMERGENCY_IDS = EMERGENCIES.map((e) => e.id);

/** Find an emergency by id (or null). */
export function getEmergency(id) {
  return EMERGENCIES.find((e) => e.id === id) || null;
}

/** Search emergencies by free-text query against name + tags. */
export function searchEmergencies(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return EMERGENCIES;
  return EMERGENCIES.filter((e) =>
    e.name.toLowerCase().includes(q) ||
    e.tags.some((t) => t.toLowerCase().includes(q)) ||
    e.id.includes(q));
}

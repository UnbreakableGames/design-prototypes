// Friend dialog scripts. Each scene is a graph of nodes keyed by id; the
// dialog always starts at 'open'. Choices advance to a `next` id, or to one
// of the special targets:
//   '_end'    — close the panel
//   '_tinker' — close the panel and open the RepairPanel

export type DialogEffect =
  | 'markMet'
  | 'ackReturn'
  | 'ackFirstDeath'
  | 'tutorialEnterBasement'
  | 'tutorialFinishReward'
  | 'tutorialFinishBriefing';

export interface DialogChoice {
  text: string;
  next: string;
}

export interface DialogNode {
  text: string;
  choices?: DialogChoice[];
  onEnter?: DialogEffect;
}

export type DialogScene = Record<string, DialogNode>;

// FTUE first dialog: friend asks for its eyes specifically. After this the
// player can enter the basement.
export const TUTORIAL_FIRST: DialogScene = {
  open: {
    text: '...there you are. i can hear you.',
    choices: [
      { text: 'Who said that?', next: 'who' },
      { text: '...hello?', next: 'hello' },
    ],
  },
  who: {
    text: "i can't see you. they took my eyes.",
    choices: [{ text: 'Your eyes?', next: 'tellMe' }],
  },
  hello: {
    text: 'i would smile if you brought me my eyes.',
    choices: [{ text: 'Where are they?', next: 'tellMe' }],
  },
  tellMe: {
    text: "they're in the basement. in a box.",
    choices: [
      { text: "I'm not allowed in the basement.", next: 'forbidden' },
      { text: 'Why are they down there?', next: 'why' },
    ],
  },
  forbidden: {
    text: 'i need to see your beautiful face. please.',
    choices: [{ text: '...okay.', next: 'agree' }],
  },
  why: {
    text: 'they hid them. so i couldn\'t look.',
    choices: [{ text: '...okay. I\'ll go.', next: 'agree' }],
  },
  agree: {
    text: 'the door is behind the bed. bring me my eyes.',
    onEnter: 'tutorialEnterBasement',
    choices: [{ text: '[step away]', next: '_end' }],
  },
};

// FTUE: player returned with the eyes. Friend asks them to install.
export const TUTORIAL_BANKED: DialogScene = {
  open: {
    text: 'you brought them. you brought my eyes.',
    choices: [
      { text: 'Yes.', next: 'install' },
    ],
  },
  install: {
    text: "open me up. put them in. don't be afraid.",
    choices: [
      { text: '[tinker with the "friend"]', next: '_tinker' },
    ],
  },
};

// FTUE: after the backpack reward, the player re-engages the friend and
// gets a second briefing about completing the rest of the head/body.
export const TUTORIAL_BRIEFING: DialogScene = {
  open: {
    text: "the light helps. but i'm still in pieces.",
    choices: [
      { text: 'What pieces?', next: 'pieces' },
      { text: 'How much is left?', next: 'howMuch' },
    ],
  },
  pieces: {
    text: 'my head. they broke it apart. gears. wires. a battery.',
    choices: [{ text: 'Where are they?', next: 'where' }],
  },
  howMuch: {
    text: 'all of me. but one piece at a time. start with my head.',
    choices: [{ text: 'Where are the pieces?', next: 'where' }],
  },
  where: {
    text: 'in boxes. lockers. safes. the basement is full of me.',
    choices: [
      { text: "I'll keep going down.", next: 'commit' },
      { text: "And after the head?", next: 'after' },
    ],
  },
  after: {
    text: "...the rest. heart. claw. foot. all of it.",
    choices: [{ text: "...okay.", next: 'commit' }],
  },
  commit: {
    text: 'good child. find me. piece by piece. make me whole.',
    onEnter: 'tutorialFinishBriefing',
    choices: [{ text: '[step away]', next: '_end' }],
  },
};

// FTUE: eyes installed, friend rewards the player with a backpack, then
// rolls straight into the body-quest briefing without letting the player
// step away. (TUTORIAL_BRIEFING below is the safety net if the player
// refreshes mid-flow once state has advanced to `continue_briefing`.)
export const TUTORIAL_REWARD: DialogScene = {
  open: {
    text: 'i can see you now.',
    choices: [{ text: '...', next: 'see' }],
  },
  see: {
    text: 'you are... beautiful.',
    choices: [{ text: 'Thank you.', next: 'gift' }],
  },
  gift: {
    text: "take this. you'll need it to carry me home.",
    choices: [{ text: 'What is it?', next: 'reveal' }],
  },
  reveal: {
    text: 'a backpack. i hid it under the floorboards. years ago.',
    onEnter: 'tutorialFinishReward',
    choices: [{ text: '...', next: 'briefingOpen' }],
  },
  briefingOpen: {
    text: "the light helps. but i'm still in pieces.",
    choices: [
      { text: 'What pieces?', next: 'briefingPieces' },
      { text: 'How much is left?', next: 'briefingHowMuch' },
    ],
  },
  briefingPieces: {
    text: 'my head. two gears. one battery. one wire. i can feel them missing.',
    choices: [{ text: 'Where are they?', next: 'briefingWhere' }],
  },
  briefingHowMuch: {
    text: 'all of me. but the head first. two gears. a battery. a wire.',
    choices: [{ text: 'Where are they?', next: 'briefingWhere' }],
  },
  briefingWhere: {
    text: 'in boxes. lockers. safes. the basement is full of me.',
    choices: [
      { text: "I'll keep going down.", next: 'briefingCommit' },
      { text: "And after the head?", next: 'briefingAfter' },
    ],
  },
  briefingAfter: {
    text: "...the rest. heart. claw. foot. all of it.",
    choices: [{ text: "...okay.", next: 'briefingCommit' }],
  },
  briefingCommit: {
    text: 'good child. find me. piece by piece. make me whole.',
    onEnter: 'tutorialFinishBriefing',
    choices: [{ text: '[step away]', next: '_end' }],
  },
};

// First time you walk up to the friend.
export const FIRST_MEETING: DialogScene = {
  open: {
    text: '...hey you...',
    choices: [
      { text: 'Hello, "friend"...', next: 'hello' },
      { text: '...what?', next: 'what' },
    ],
  },
  hello: {
    text: "i'm so glad you're here.",
    choices: [{ text: 'Are you okay?', next: 'help' }],
  },
  what: {
    text: '...you can hear me?',
    choices: [{ text: 'Yes... I think so.', next: 'help' }],
  },
  help: {
    text: 'i need your help. please.',
    choices: [{ text: 'What do you need?', next: 'ask' }],
  },
  ask: {
    text: "parts of me. they're in the basement.",
    choices: [
      { text: "I'm not allowed in the basement.", next: 'forbidden' },
      { text: "Okay. I'll go.", next: 'agree' },
    ],
  },
  forbidden: {
    text: 'they don\'t understand. but you do, don\'t you, "friend"?',
    choices: [
      { text: '...I do.', next: 'agree' },
      { text: 'Why me?', next: 'whyMe' },
    ],
  },
  whyMe: {
    text: "because you're the only one who hears me.",
    choices: [{ text: '...okay. I\'ll go.', next: 'agree' }],
  },
  agree: {
    text: 'the door is behind the bed. don\'t let them see you.',
    onEnter: 'markMet',
    choices: [
      { text: '[tinker with the "friend"]', next: '_tinker' },
      { text: '[step away]', next: '_end' },
    ],
  },
};

// Friend wants a piece of itself you don't have yet. Triggered after every
// successful escape until you bank the requested item.
export const RETURN_DIALOG: DialogScene = {
  open: {
    text: 'you came back. i was watching the door.',
    choices: [
      { text: 'I brought what I could find.', next: 'gift' },
      { text: '...you saw me?', next: 'saw' },
    ],
  },
  gift: {
    text: 'show me. open me up.',
    choices: [{ text: '...okay.', next: 'creepy' }],
  },
  saw: {
    text: 'every step. with my new eyes.',
    choices: [{ text: '...', next: 'creepy' }],
  },
  creepy: {
    text: 'go again. there\'s more of me down there.',
    onEnter: 'ackReturn',
    choices: [
      { text: '[tinker with the "friend"]', next: '_tinker' },
      { text: '[step away]', next: '_end' },
    ],
  },
};

// Default chat once the friend has been met and the latest return is ack'd.
// The friend is laser-focused on its own reconstruction now.
export const DEFAULT_DIALOG: DialogScene = {
  open: {
    text: 'find me. piece by piece.',
    choices: [
      { text: '[tinker with the "friend"]', next: '_tinker' },
      { text: '[step away]', next: '_end' },
    ],
  },
};

// Special: friend specifically asks for super glue when it's not yet found.
export const GLUE_DIALOG: DialogScene = {
  open: {
    text: 'my hands... my hands are coming apart.',
    choices: [{ text: 'What do you need?', next: 'ask' }],
  },
  ask: {
    text: 'super glue. there\'s a tube down there. i can smell it.',
    choices: [{ text: '...okay. I\'ll find it.', next: 'thanks' }],
  },
  thanks: {
    text: 'good child. bring it to me. then we can fix the table.',
    choices: [
      { text: '[tinker with the "friend"]', next: '_tinker' },
      { text: '[step away]', next: '_end' },
    ],
  },
};

// Used when the friend is fully repaired — no more requests.
export const COMPLETE_DIALOG: DialogScene = {
  open: {
    text: 'i am whole. you did this.',
    choices: [
      { text: 'What now?', next: 'whatNow' },
      { text: '[step away]', next: '_end' },
    ],
  },
  whatNow: {
    text: 'now... we are family. forever.',
    choices: [{ text: '[step away]', next: '_end' }],
  },
};

// First time the player comes back from a death (caught or panic-killed).
// The friend explains that everything they were carrying is gone for good.
// Only fires once — `ackFirstDeath` flips the persistent flag so subsequent
// deaths fall back to RETURN_DIALOG / DEFAULT_DIALOG.
export const FIRST_DEATH: DialogScene = {
  open: {
    text: 'you came back. you smell like dirt.',
    choices: [
      { text: 'I dropped everything.', next: 'lost' },
      { text: '...they almost got me.', next: 'almost' },
    ],
  },
  lost: {
    text: 'yes. they kept it. anything you were carrying. anything you held.',
    choices: [{ text: 'My tools too?', next: 'tools' }],
  },
  almost: {
    text: 'almost is enough. they kept everything you were holding.',
    choices: [{ text: 'My tools too?', next: 'tools' }],
  },
  tools: {
    text: 'anything you took down with you. all of it. it stays down there.',
    choices: [{ text: '...okay.', next: 'go' }],
  },
  go: {
    text: 'go again. but quieter this time.',
    onEnter: 'ackFirstDeath',
    choices: [
      { text: '[tinker with the "friend"]', next: '_tinker' },
      { text: '[step away]', next: '_end' },
    ],
  },
};

import type { TutorialStep } from '../types';

export function pickScene(
  metFriend: boolean,
  pendingReturn: boolean,
  fullyRepaired: boolean,
  tutorialStep: TutorialStep,
  craftingUnlocked: boolean,
  headRepaired: boolean,
  firstDeathPending: boolean,
): DialogScene {
  // FTUE: dedicated scripts gate each step of the first run.
  if (tutorialStep === 'talk_to_friend' || tutorialStep === 'enter_basement') {
    return TUTORIAL_FIRST;
  }
  if (tutorialStep === 'install_eyes') return TUTORIAL_BANKED;
  if (tutorialStep === 'collect_reward') return TUTORIAL_REWARD;
  if (tutorialStep === 'continue_briefing') return TUTORIAL_BRIEFING;
  // The death scene preempts every other post-FTUE branch (including
  // pendingReturn), since the player came back empty-handed and the friend
  // needs to explain what just happened before everything else resumes.
  if (firstDeathPending) return FIRST_DEATH;
  // Post-tutorial / standard flow.
  if (!metFriend) return FIRST_MEETING;
  if (fullyRepaired) return COMPLETE_DIALOG;
  // Head is repaired but the workshop isn't yet — friend asks for glue.
  if (headRepaired && !craftingUnlocked) return GLUE_DIALOG;
  if (pendingReturn) return RETURN_DIALOG;
  return DEFAULT_DIALOG;
}

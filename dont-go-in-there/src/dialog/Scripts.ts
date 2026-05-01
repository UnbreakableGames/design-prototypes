// Friend dialog scripts. Each scene is a graph of nodes keyed by id; the
// dialog always starts at 'open'. Choices advance to a `next` id, or to one
// of the special targets:
//   '_end'    — close the panel
//   '_tinker' — close the panel and open the RepairPanel

export type DialogEffect = 'markMet' | 'ackReturn';

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

// First time you walk up to the friend.
export const FIRST_MEETING: DialogScene = {
  open: {
    text: '...hey you...',
    choices: [
      { text: 'Hello, friend...', next: 'hello' },
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
    text: "they don't understand. but you do, don't you, friend?",
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
      { text: '[tinker with the friend]', next: '_tinker' },
      { text: '[step away]', next: '_end' },
    ],
  },
};

// Triggered the first time you talk to the friend after a successful escape.
export const RETURN_DIALOG: DialogScene = {
  open: {
    text: "you came back. i wasn't sure you would.",
    choices: [
      { text: 'I brought what I could find.', next: 'gift' },
      { text: 'Are you okay?', next: 'okay' },
    ],
  },
  gift: {
    text: 'good. i can feel them. closer.',
    choices: [{ text: '...closer to what?', next: 'creepy' }],
  },
  okay: {
    text: "i won't eat you. yet.",
    choices: [{ text: '...what?', next: 'joke' }],
  },
  joke: {
    text: "a joke. friends joke, don't they.",
    choices: [{ text: '...yeah. friends.', next: 'creepy' }],
  },
  creepy: {
    text: 'go again. there is more of me down there.',
    onEnter: 'ackReturn',
    choices: [
      { text: '[tinker with the friend]', next: '_tinker' },
      { text: '[step away]', next: '_end' },
    ],
  },
};

// Default chat once the friend has been met and acknowledged the latest return.
export const DEFAULT_DIALOG: DialogScene = {
  open: {
    text: 'find me my pieces. all of them.',
    choices: [
      { text: '[tinker with the friend]', next: '_tinker' },
      { text: '[step away]', next: '_end' },
    ],
  },
};

export function pickScene(metFriend: boolean, pendingReturn: boolean): DialogScene {
  if (!metFriend) return FIRST_MEETING;
  if (pendingReturn) return RETURN_DIALOG;
  return DEFAULT_DIALOG;
}

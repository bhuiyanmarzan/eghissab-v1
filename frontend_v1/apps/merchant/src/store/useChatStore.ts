import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChatFilter = 'all' | 'unread' | 'favorites' | 'group';
export type ChatAttachment = { id: string; name: string; type: string; size: number };
export type ChatMessage = {
  id: string;
  text: string;
  outgoing: boolean;
  time: string;
  timestamp?: number;
  demo?: boolean;
  attachments?: ChatAttachment[];
};
export type Conversation = {
  id: string;
  name: string;
  avatar?: string;
  online?: boolean;
  group?: boolean;
  favorite: boolean;
  unread: boolean;
  time: string;
  messages: ChatMessage[];
};
export type ChatDraft = { text: string; attachments: ChatAttachment[] };
const seed: [string, string, string, string?][] = [
  ['alene', 'Alene', 'Yes, I saw it. Working on a fix now. Should be done by EOD.', 'cristina'],
  ['keefe', 'Keefe', "Agreed! Next time, let's try sushi.", 'aida'],
  [
    'lazaro',
    'Lazaro',
    'Just uploaded them to the shared drive. Let me know if you need anything else!',
    'robert',
  ],
  ['hazle', 'Hazle', 'Thanks! Let me know if you spot any issues.', 'emily'],
  ['backend', 'Backend Squad', 'Database migration scheduled for tonight.'],
  ['herman', 'Herman Essertg', "Thanks for the heads up! I'll prepare the slides tonight."],
  ['wilhelmine', 'Wilhelmine Durrg', 'Just sent it to your email!'],
  ['agilulf', 'Agilulf Fuxg', 'Awesome, thanks for setting that up!'],
  ['adaline', 'Adaline Bergfalks', 'Great to hear! Let me know if they need more examples.'],
  ['eadwulf', 'Eadwulf Beckete', 'Thanks for your help debugging!'],
  ['midas', 'Midas', 'Thanks! Glad it was helpful.'],
  ['uranus', 'Uranus', 'Perfect! Thanks for handling the deployment.'],
  ['peahen', 'Peahen', 'Thanks for reviewing the code so quickly!'],
  ['menelaus', 'Menelaus', "That's awesome news! Thanks for sharing."],
  ['frontend', 'Frontend Team', "Let's finalize the UI components by tomorrow."],
];
const aleneThread: [boolean, string, string][] = [
  [true, 'Hey, have you checked the new design draft?', '5:15 PM'],
  [false, 'Yes, I reviewed it this morning. Looks good overall.', '5:20 PM'],
  [true, 'Great! Do you think we should update the header section?', '5:22 PM'],
  [false, 'Yeah, the font size feels a bit small.', '5:40 PM'],
  [true, "Okay, I'll fix that and share an updated version today.", '5:41 PM'],
  [false, "Perfect. Also, don't forget to add the client logo on the first slide.", '5:45 PM'],
  [true, 'Got it 👍 Anything else?', '6:15 PM'],
  [false, "Nope, that's all for now. Thanks for the quick update!", '6:15 PM'],
  [false, 'Hey, did you get a chance to review the bug report I sent?', '3:10 PM'],
  [true, seed[0][2], '3:12 PM'],
];
export const initialConversations: Conversation[] = seed.map(([id, name, text, avatar], index) => ({
  id,
  name,
  avatar,
  online: index < 3,
  group: id === 'backend' || id === 'frontend',
  favorite: ['alene', 'backend', 'herman', 'midas'].includes(id),
  unread: [0, 1, 2, 4].includes(index),
  time: [
    '11:30 AM',
    '10:16 AM',
    '9:00 AM',
    '08:36 AM',
    'Yesterday',
    'Yesterday',
    'Yesterday',
    'Yesterday',
    '20 Aug',
    '20 Aug',
    '19 Aug',
    '19 Aug',
    '18 Aug',
    '18 Aug',
    '09:00 AM',
  ][index],
  messages: (id === 'alene'
    ? aleneThread
    : ([[index > 2 && id !== 'backend', text, '9:00 AM']] as [boolean, string, string][])
  ).map(([outgoing, text, time], i) => ({ id: `${id}-${i}`, text, time, outgoing, demo: true })),
}));
export const emptyDraft: ChatDraft = { text: '', attachments: [] };
export const draftKey = (tenant: string, id: string) => `${tenant}:${id}`;
export function filterChats(items: Conversation[], filter: ChatFilter) {
  return items.filter((item) =>
    filter === 'unread'
      ? item.unread
      : filter === 'favorites'
        ? item.favorite
        : filter === 'group'
          ? item.group
          : true,
  );
}
type ChatState = {
  tenants: Record<string, Conversation[]>;
  drafts: Record<string, ChatDraft>;
  markRead: (tenant: string, id?: string) => void;
  toggleFavorite: (tenant: string, id: string) => void;
  updateDraft: (tenant: string, id: string, draft: Partial<ChatDraft>) => void;
  sendMessage: (tenant: string, id: string) => boolean;
};
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      tenants: {},
      drafts: {},
      markRead: (tenant, id) =>
        set((state) => ({
          tenants: {
            ...state.tenants,
            [tenant]: (state.tenants[tenant] ?? initialConversations).map((item) =>
              !id || item.id === id ? { ...item, unread: false } : item,
            ),
          },
        })),
      toggleFavorite: (tenant, id) =>
        set((state) => ({
          tenants: {
            ...state.tenants,
            [tenant]: (state.tenants[tenant] ?? initialConversations).map((item) =>
              item.id === id ? { ...item, favorite: !item.favorite } : item,
            ),
          },
        })),
      updateDraft: (tenant, id, draft) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [draftKey(tenant, id)]: {
              ...(state.drafts[draftKey(tenant, id)] ?? emptyDraft),
              ...draft,
            },
          },
        })),
      sendMessage: (tenant, id) => {
        const state = get();
        const draft = state.drafts[draftKey(tenant, id)] ?? emptyDraft;
        const conversations = state.tenants[tenant] ?? initialConversations;
        if (
          (!draft.text.trim() && !draft.attachments.length) ||
          !conversations.some((item) => item.id === id)
        )
          return false;
        const now = Date.now();
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          text: draft.text.trim().slice(0, 4000),
          outgoing: true,
          timestamp: now,
          time: '',
          attachments: draft.attachments,
        };
        const tenants = {
          ...state.tenants,
          [tenant]: conversations.map((item) =>
            item.id === id
              ? { ...item, unread: false, time: 'Just now', messages: [...item.messages, message] }
              : item,
          ),
        };
        const drafts = { ...state.drafts, [draftKey(tenant, id)]: emptyDraft };
        // Fail before changing the conversation if the browser cannot save it. No simulated delivery receipts.
        localStorage.setItem(
          'mantis-quick-chat',
          JSON.stringify({ state: { tenants, drafts }, version: 1 }),
        );
        set({ tenants, drafts });
        return true;
      },
    }),
    {
      name: 'mantis-quick-chat',
      version: 1,
      partialize: (state) => ({ tenants: state.tenants, drafts: state.drafts }),
    },
  ),
);

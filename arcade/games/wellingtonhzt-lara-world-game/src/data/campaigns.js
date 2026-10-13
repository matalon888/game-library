import { WORLD_IDS } from './world-manifest.js';

export class InvalidCampaignError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidCampaignError';
  }
}

const MAIN_CAMPAIGN = {
  id: 'lara-world-principal',
  name: 'Aventura Lara World',
  worldOrder: [
    'floresta-encantada',
    'dinossauros',
    'galaxia-estelar',
    'reino-oceanos',
    'castelo-dragoes',
  ],
};

function freezeCampaign(campaign) {
  return Object.freeze({
    ...campaign,
    worldOrder: Object.freeze([...campaign.worldOrder]),
  });
}

export function validateCampaign(campaign, validWorldIds = WORLD_IDS) {
  if (!campaign || typeof campaign !== 'object') {
    throw new InvalidCampaignError('Campaign must be a non-null object');
  }
  if (typeof campaign.id !== 'string' || campaign.id.length === 0) {
    throw new InvalidCampaignError('Campaign must have a non-empty id');
  }
  if (typeof campaign.name !== 'string' || campaign.name.length === 0) {
    throw new InvalidCampaignError('Campaign must have a non-empty name');
  }
  if (!Array.isArray(campaign.worldOrder) || campaign.worldOrder.length === 0) {
    throw new InvalidCampaignError('Campaign must contain at least one world');
  }

  const knownWorlds = new Set(validWorldIds);
  const seen = new Set();
  for (const worldId of campaign.worldOrder) {
    if (typeof worldId !== 'string' || !knownWorlds.has(worldId)) {
      throw new InvalidCampaignError(`Unknown world id "${worldId}"`);
    }
    if (seen.has(worldId)) {
      throw new InvalidCampaignError(`Duplicate world id "${worldId}"`);
    }
    seen.add(worldId);
  }
  return true;
}

validateCampaign(MAIN_CAMPAIGN);

const CAMPAIGNS = Object.freeze([
  freezeCampaign(MAIN_CAMPAIGN),
]);

export const MAIN_CAMPAIGN_ID = MAIN_CAMPAIGN.id;

export function listCampaigns() {
  return [...CAMPAIGNS];
}

export function getCampaign(id) {
  const campaign = CAMPAIGNS.find(item => item.id === id);
  if (!campaign) throw new InvalidCampaignError(`Campaign "${id}" not found`);
  return campaign;
}

export function projectCampaignWorldOrder(campaign) {
  validateCampaign(campaign);
  return campaign.worldOrder.map((worldId, index) => ({
    worldId,
    order: index + 1,
  }));
}

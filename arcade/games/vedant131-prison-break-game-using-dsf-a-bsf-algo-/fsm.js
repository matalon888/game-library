// fsm.js — Guard Finite State Machine
const FSM_STATE = { PATROL:'PATROL', CHASE:'CHASE', SEARCH:'SEARCH' };

class GuardFSM {
  constructor(guard){
    this.guard=guard;
    this.state=FSM_STATE.PATROL;
    this.searchTimer=0;
    this.SEARCH_DURATION=guard.searchDur||4500;
  }
  transition(s){
    if(this.state===s) return;
    this.state=s;
    if(s===FSM_STATE.PATROL){
      this.guard.patrolVisited.clear();
      this.guard.patrolStack=[];
      const cur=Utils.worldToTile(this.guard.x,this.guard.y,MAP_TILE_SIZE);
      this.guard.patrolStack.push(cur);
    }
    if(s===FSM_STATE.CHASE) this.guard.chaseTimer=0;
    if(s===FSM_STATE.SEARCH){
      this.searchTimer=this.SEARCH_DURATION;
      if(this.guard.onEnterSearch) this.guard.onEnterSearch();
    }
  }
  update(dt,canSee){
    switch(this.state){
      case FSM_STATE.PATROL: if(canSee) this.transition(FSM_STATE.CHASE); break;
      case FSM_STATE.CHASE:  if(!canSee) this.transition(FSM_STATE.SEARCH); break;
      case FSM_STATE.SEARCH:
        if(canSee) this.transition(FSM_STATE.CHASE);
        else{ this.searchTimer-=dt; if(this.searchTimer<=0) this.transition(FSM_STATE.PATROL); }
        break;
    }
    return this.state;
  }
}

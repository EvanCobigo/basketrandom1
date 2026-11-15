// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does one key plus floppy physics give a match that is chaotic, funny and still winnable on skill?
// Date: 2026-11-14
'use strict';
/** Scoring: pure rules for baskets and the match. No physics, no drawing. */
const Scoring = {
  /**
   * The hoop the ball dropped through during this step, or null.
   * A basket is the ball's centre crossing the rim line downward between the backboard and the front rim.
   * @param {{x:number,y:number}} prev ball centre before the step
   * @param {{x:number,y:number}} cur ball centre after the step
   * @param {{rimY:number,x1:number,x2:number}[]} hoops
   */
  basket(prev, cur, hoops) {
    for (const h of hoops) {
      if (prev.y < h.rimY && cur.y >= h.rimY) {
        const t = (h.rimY - prev.y) / (cur.y - prev.y);   // where on the step it crossed
        const x = prev.x + (cur.x - prev.x) * t;
        if (x > h.x1 && x < h.x2) return h;
      }
    }
    return null;
  },
  /**
   * Points for a basket: 2 for a jump shot released on the far side of the centre line from the
   * hoop it went in, 1 for anything else (dunks, close shots, scrambles).
   * @param {{kind:string, fromX:number}|null} shot the shot that went in, if it was the scorer's own
   * @param {number} hoopX the hoop's centre
   * @param {number} centreX the court's centre line
   */
  points(shot, hoopX, centreX) {
    if (!shot || shot.kind === 'dunk' || shot.fromX === undefined) return 1;
    return (shot.fromX - centreX) * Math.sign(hoopX - centreX) < 0 ? 2 : 1;
  },
  /** Index of the team that has reached `target`, or -1. */
  winner(score, target) {
    return score[0] >= target ? 0 : score[1] >= target ? 1 : -1;
  },
  /** Index of the leading team, or -1 when level. */
  leader(score) {
    return score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1;
  },
};

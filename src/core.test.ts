import { describe, expect, it } from 'vitest';
import { activeLine, constrainBounds, defaults, parseLrc, readSettings, resizeBounds } from './core';
describe('LRC timeline',()=>{
  it('handles repeated timestamps, Unicode, fractions, metadata and unordered lines',()=>{
    expect(parseLrc('[ar:Author]\n[00:10.50]終わり\n[00:01.1][00:03,250]hello\n[00:02.005]\n[00:99]invalid')).toEqual([
      {time:1.1,text:'hello'},{time:2.005,text:''},{time:3.25,text:'hello'},{time:10.5,text:'終わり'}]);
  });
  it('applies embedded positive offset once, and manual offset independently',()=>{
    const lines=parseLrc('[offset:500]\n[00:02.00]first\n[00:04.00]second');
    expect(lines[0].time).toBe(1.5);expect(activeLine(lines,1.4)).toBe(-1);expect(activeLine(lines,1.4,100)).toBe(0);
    expect(activeLine(lines,3.6,-200)).toBe(0);expect(activeLine(lines,4)).toBe(1);
  });
  it('selects new line at boundary and seeks backwards without drift',()=>{
    const lines=parseLrc('[00:00]one\n[00:04]two\n[00:08]three');
    expect(activeLine(lines,7.99)).toBe(1);expect(activeLine(lines,8)).toBe(2);expect(activeLine(lines,1)).toBe(0);
    expect(activeLine([],10)).toBe(-1);
  });
});
describe('overlay geometry',()=>{
  const b={x:100,y:100,width:400,height:200};
  it.each(['nw','ne','sw','se'])('preserves the opposite corner for %s resize',corner=>{
    const next=resizeBounds(b,20,30,corner,1000,700);
    if(corner.includes('w'))expect(next.x+next.width).toBe(500);else expect(next.x).toBe(100);
    if(corner.includes('n'))expect(next.y+next.height).toBe(300);else expect(next.y).toBe(100);
  });
  it('recovers offscreen bounds after shrinking the viewport',()=>{
    expect(constrainBounds({x:1700,y:900,width:500,height:300},320,250)).toEqual({x:0,y:0,width:320,height:250});
  });
  it('clamps extreme resizing to prevent inverted dimensions',()=>{
    const next=resizeBounds(b,900,900,'nw',1000,700);expect(next.width).toBe(240);expect(next.height).toBe(100);
  });
});
describe('preferences recovery',()=>{
  it('recovers corrupt or unsupported storage',()=>{expect(readSettings('{bad')).toEqual(defaults);expect(readSettings('{"version":99}')).toEqual(defaults);});
  it('validates fields instead of trusting imported preferences',()=>{
    const result=readSettings(JSON.stringify({version:1,fontSize:900,color:'url(evil)',collapseDelay:-1,bounds:{x:'x'},opacity:200}));
    expect(result.fontSize).toBe(64);expect(result.color).toBe(defaults.color);expect(result.collapseDelay).toBe(500);expect(result.bounds).toEqual(defaults.bounds);expect(result.opacity).toBe(100);
  });
});

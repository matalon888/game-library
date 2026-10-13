'use strict';
// Keep failures useful even when an assertion contains a whole replay bundle.
module.exports=async function* report(events) {
    let passed=0,failed=0,skipped=0;
    yield 'Running tests…\n';
    for await(const {type,data} of events) {
        if(type==='test:pass'){if(data.skip)skipped++;else passed++;}
        if(type!=='test:fail')continue;
        const error=data.details?.error;
        if(error?.failureType==='subtestsFailed')continue;
        failed++;
        const cause=error?.cause||error;
        const message=String(cause?.message||error?.message||'Test failed');
        const excerpt=message.slice(0,1400);
        const stack=String(cause?.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,5).map(line=>line.slice(0,240)).join('\n');
        yield `\nFAIL: ${String(data.name).slice(0,240)}\n${data.file||''}:${data.line||''}\n${excerpt}${message.length>1400?'\n[Assertion output truncated; rerun the named test locally.]':''}\n${stack}\n`;
    }
    yield `\n${passed} passed; ${failed} failed; ${skipped} skipped.\n`;
};

"use strict";(self.webpackChunkclient=self.webpackChunkclient||[]).push([[721,423,819],{3982:function(e,n,r){r.d(n,{Ee:function(){return d},xs:function(){return m},B7:function(){return h},ZD:function(){return p},_w:function(){return Z}});var a=r(1413),t=r(9439),c=r(2791),i=r(1091),s=r(6928),o=r(1694),u=r.n(o),l=r(3773),f=r(184),d=function(e){var n=e.name,r="".concat("variables",".").concat(n),o=(0,l.N)(),d=(0,l.C)(r)||"",m=(0,c.useState)({}),v=(0,t.Z)(m,2),h=v[0],p=v[1],Z=(0,c.useRef)(null);return(0,c.useEffect)((function(){var n=e.className,r=e.src,t=void 0!==r&&r;p((0,a.Z)((0,a.Z)({},e),{},{className:u()("variable",n),src:t?"".concat(o,"/").concat(t.replace(/:var:/,d)):"1x1.png"}))}),[e,o,d]),(0,f.jsx)(i.Z,{children:(0,f.jsx)(s.Z,{addEndListener:function(e){return Z.current.addEventListener("transitionend",e,!0)},appear:!0,nodeRef:Z,children:(0,f.jsx)("img",(0,a.Z)({ref:Z},h))},d)})},m=function(e){var n=e.children,r=e.className,a=e.id;return(0,f.jsx)("div",{id:a,className:u()(r,"overflow-hidden"),children:n})},v=r(6707),h=function(e){var n=e.name,r="".concat("timers",".").concat(n),i=(0,v.J)({path:r}),o=i.active,l=i.text,d=(0,c.useState)({}),m=(0,t.Z)(d,2),h=m[0],p=m[1],Z=(0,c.useRef)(null);return(0,c.useEffect)((function(){var n=e.className;p((0,a.Z)((0,a.Z)({},e),{},{className:u()("timer",n)}))}),[e]),(0,f.jsx)(s.Z,{addEndListener:function(e){return Z.current.addEventListener("transitionend",e)},appear:!0,in:o,nodeRef:Z,children:(0,f.jsx)("span",(0,a.Z)((0,a.Z)({ref:Z},h),{},{children:l}))})},p=function(e){var n=e.children,r=e.name,i="".concat("toggles",".").concat(r),o=(0,l.C)(i)||!1,d=(0,c.useState)({}),m=(0,t.Z)(d,2),v=m[0],h=m[1],p=(0,c.useRef)(null);return(0,c.useEffect)((function(){var n=e.className;h((0,a.Z)((0,a.Z)({},e),{},{className:u()("toggle",n)}))}),[e,o]),(0,f.jsx)(s.Z,{addEndListener:function(e){return p.current.addEventListener("transitionend",e,!0)},appear:!0,in:o,nodeRef:p,children:(0,f.jsx)("div",(0,a.Z)((0,a.Z)({ref:p},v),{},{children:n}))})},Z=function(e){var n=e.name,r="".concat("variables",".").concat(n),o=(0,l.C)(r)||"",d=(0,c.useState)({}),m=(0,t.Z)(d,2),v=m[0],h=m[1],p=(0,c.useRef)(null);return(0,c.useEffect)((function(){var n=e.className;h((0,a.Z)((0,a.Z)({},e),{},{className:u()("variable",n)}))}),[e,o]),(0,f.jsx)(i.Z,{children:(0,f.jsx)(s.Z,{addEndListener:function(e){return p.current.addEventListener("transitionend",e,!0)},appear:!0,nodeRef:p,children:(0,f.jsx)("var",(0,a.Z)((0,a.Z)({ref:p},v),{},{children:o}))},o)})}},6707:function(e,n,r){r.d(n,{J:function(){return s}});var a=r(9439),t=r(2791),c=r(3773);function i(e){if(!e||e<=0)return"00:00";var n=new Date(e).toISOString();return e>=36e5?n.slice(11,-5):n.slice(14,-5)}var s=function(e){var n=e.path,r=(0,c.C)(n),s=(0,t.useState)(0),o=(0,a.Z)(s,2),u=o[0],l=o[1],f=(0,t.useRef)(null);return(0,t.useEffect)((function(){l(r>0?Math.ceil(r-Date.now()):-1),r||clearTimeout(f.current)}),[r]),(0,t.useMemo)((function(){var e={active:u>=0,text:i(u)};return clearTimeout(f.current),u>=0&&(f.current=setTimeout((function(){return l(u-1e3)}),1e3)),e}),[u])}},3773:function(e,n,r){r.d(n,{N:function(){return t},C:function(){return s}});var a=r(7689),t=function(){var e=(0,a.UO)();return"./".concat(e.code)},c=r(9434),i=r(9632),s=function(e){return(0,c.v9)((function(n){return(0,i.nZ)(n,e)}))}},819:function(e,n,r){r.r(n);var a=r(2592),t=r(3773),c=r(3982),i=r(8423),s=r(184);n.default=function(e){var n,r=e.player,o=(0,t.C)("variables.players.".concat(r,".deck.faction")),u=(0,t.N)(),l=(null===i||void 0===i||null===(n=i[o])||void 0===n?void 0:n.units)||{};return(0,s.jsx)("div",{className:"arsenal d-flex justify-content-center pb-2 w-100",children:Object.values(l).map((function(e){return e.map((function(e){return(0,s.jsx)(c.ZD,{className:"m-1",name:"players.".concat(r,".deck.units.").concat(e),children:(0,s.jsx)(a.Z,{src:"".concat(u,"/units/").concat(e,".webp"),fluid:!0})},e)}))}))})}},2518:function(e,n,r){r.r(n);var a=r(9439),t=r(2791),c=r(2592),i=r(1694),s=r.n(i),o=r(3773),u=r(184);n.default=function(e){var n=e.player,r=e.reverse,i=(0,o.N)(),l=+(0,o.C)("variables.players.".concat(n,".score"))||0,f=(0,o.C)("variables.players.".concat(n,".deck.faction")),d=+(0,o.C)("variables.series.game.max")||3,m=(0,t.useState)([0,0,0]),v=(0,a.Z)(m,2),h=v[0],p=v[1];return(0,t.useEffect)((function(){var e=Math.floor((d||1)/2)+1;p(Array(e).fill((function(){return 0})))}),[d]),(0,u.jsx)("p",{className:s()("score d-flex",r?"flex-row-reverse":"flex-row","mb-1"),children:h.map((function(e,n){return(0,u.jsx)(c.Z,{src:"".concat(i,"/overlay/game/points/").concat(f,"-").concat(l<=n?0:1,".png")},n)}))})}},4721:function(e,n,r){r.r(n),r.d(n,{Deck:function(){return a.default},Scoreboard:function(){return t.default}});var a=r(819),t=r(2518)},8423:function(e){e.exports=JSON.parse('{"GDI":{"commanders":["Jackson","Liang","McNeil","Solomon","Strongarm"],"units":{"barracks":["Riflemen","Missile Squad","MG Squad","Jump Jet Troopers","Shockwave Troopers","Sniper Team","Grenadiers"],"vehicles":["War Dogs","Rhino","MSV","Pitbull","Shatterer","Slingshot","MLRS","Predator Tank","APC","Battering Ram"],"aircraft":["Drone Swarm","Talon","Mohawk Gunship","Razorback","Orca","Hammerhead","Orca Bomber"],"tech":["Wolverine","Disruptor","Juggernaut","Zone Troopers","Kodiak","Sandstorm","Titan","Mammoth Tank"]}},"Nod":{"commanders":["Seth","Kane","Jade","Oxanna"],"units":{"barracks":["Militants","Laser Squad","Fanatics","Scavengers","Flame Troopers","Scarabs","Chemical Warriors","Mutant Marauders"],"vehicles":["Cyberwheels","Attack Bikes","Buggy","Chemical Buggy","Scorpion Tank","Tick Tank","Giga-cannon","Stealth Tank"],"aircraft":["Laser Drones","Banshee","Venom","Catalyst Gunship","Shade","Inferno","Phantom"],"tech":["Widowmaker","Flame Tank","Centurion","Confessor","Artillery","Basilisk","Rockworm","Cyborgs","Avatar"]}}}')}}]);
//# sourceMappingURL=721.7079d72f.chunk.js.map
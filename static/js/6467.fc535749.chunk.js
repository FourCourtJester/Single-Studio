"use strict";(self.webpackChunkclient=self.webpackChunkclient||[]).push([[6467,3657,3754,3744,1019,6601,1468],{3982:function(e,n,a){a.d(n,{Ee:function(){return f},xs:function(){return m},B7:function(){return v},ZD:function(){return x},_w:function(){return h}});var r=a(1413),t=a(9439),s=a(2791),c=a(1091),i=a(6928),o=a(1694),l=a.n(o),u=a(8530),d=a(184),f=function(e){var n=e.name,a=(0,u.s3)({type:"variables",name:n}),o=(0,u.NJ)(),f=(0,u.CO)(a)||"",m=(0,s.useState)({}),p=(0,t.Z)(m,2),v=p[0],x=p[1],h=(0,s.useRef)(null);return(0,s.useEffect)((function(){var n=e.className,a=e.src,t=void 0!==a&&a;x((0,r.Z)((0,r.Z)({},e),{},{className:l()("variable",n),src:t?"".concat(o,"/").concat(t.replace(/:var:/,f)):"1x1.png"}))}),[e,o,f]),(0,d.jsx)(c.Z,{children:(0,d.jsx)(i.Z,{addEndListener:function(e){return h.current.addEventListener("transitionend",e,!0)},appear:!0,nodeRef:h,children:(0,d.jsx)("img",(0,r.Z)({ref:h},v))},f)})},m=function(e){var n=e.children,a=e.className,r=e.id;return(0,d.jsx)("div",{id:r,className:l()(a,"overflow-hidden"),children:n})},p=a(6707),v=function(e){var n=e.name,a=(0,u.s3)({type:"timers",name:n}),c=(0,p.J)({path:a}),o=c.active,f=c.text,m=(0,s.useState)({}),v=(0,t.Z)(m,2),x=v[0],h=v[1],j=(0,s.useRef)(null);return(0,s.useEffect)((function(){var n=e.className;h((0,r.Z)((0,r.Z)({},e),{},{className:l()("timer",n)}))}),[e]),(0,d.jsx)(i.Z,{addEndListener:function(e){return j.current.addEventListener("transitionend",e)},appear:!0,in:o,nodeRef:j,children:(0,d.jsx)("span",(0,r.Z)((0,r.Z)({ref:j},x),{},{children:f}))})},x=function(e){var n=e.children,a=e.name,c=(0,u.s3)({type:"toggles",name:a}),o=(0,u.CO)(c)||!1,f=(0,s.useState)({}),m=(0,t.Z)(f,2),p=m[0],v=m[1],x=(0,s.useRef)(null);return(0,s.useEffect)((function(){var n=e.className;v((0,r.Z)((0,r.Z)({},e),{},{className:l()("toggle",n)}))}),[e,o]),(0,d.jsx)(i.Z,{addEndListener:function(e){return x.current.addEventListener("transitionend",e,!0)},appear:!0,in:o,nodeRef:x,children:(0,d.jsx)("div",(0,r.Z)((0,r.Z)({ref:x},p),{},{children:n}))})},h=function(e){var n=e.name,a=(0,u.s3)({type:"variables",name:n}),o=(0,u.CO)(a)||"",f=(0,s.useState)({}),m=(0,t.Z)(f,2),p=m[0],v=m[1],x=(0,s.useRef)(null);return(0,s.useEffect)((function(){var n=e.className;v((0,r.Z)((0,r.Z)({},e),{},{className:l()("variable",n)}))}),[e,o]),(0,d.jsx)(c.Z,{children:(0,d.jsx)(i.Z,{addEndListener:function(e){return x.current.addEventListener("transitionend",e,!0)},appear:!0,nodeRef:x,children:(0,d.jsx)("var",(0,r.Z)((0,r.Z)({ref:x},p),{},{children:o}))},o)})}},6707:function(e,n,a){a.d(n,{J:function(){return i}});var r=a(9439),t=a(2791),s=a(8530);function c(e){if(!e||e<=0)return"00:00";var n=new Date(e).toISOString();return e>=36e5?n.slice(11,-5):n.slice(14,-5)}var i=function(e){var n=e.path,a=(0,s.CO)(n),i=(0,t.useState)(0),o=(0,r.Z)(i,2),l=o[0],u=o[1],d=(0,t.useRef)(null);return(0,t.useEffect)((function(){u(a>0?Math.ceil(a-Date.now()):-1),a||clearTimeout(d.current)}),[a]),(0,t.useMemo)((function(){var e={active:l>=0,text:c(l)};return clearTimeout(d.current),l>=0&&(d.current=setTimeout((function(){return u(l-1e3)}),1e3)),e}),[l])}},8530:function(e,n,a){a.d(n,{s3:function(){return s},NJ:function(){return c},CO:function(){return l}});var r=a(2791),t=a(7689),s=function(e){var n=e.type,a=e.name,s=(0,t.UO)().code;return(0,r.useMemo)((function(){var e=[s];return n&&e.push(n),a&&e.push(a),e.join(".")}),[s,n,a])},c=function(){var e=(0,t.UO)();return"./".concat(e.code)},i=a(9434),o=a(4074),l=function(e){return(0,i.v9)((function(n){return(0,o.nZ)(n,e)}))}},3754:function(e,n,a){a.r(n),a.d(n,{ReplayDeck:function(){return r.Deck},ReplayScoreboard:function(){return r.Scoreboard}});var r=a(3744)},1019:function(e,n,a){a.r(n);var r=a(2592),t=a(8530),s=a(3982),c=a(3657),i=a(184);n.default=function(e){var n,a=e.player,o=(0,t.s3)({type:"variables",name:"players.".concat(a,".deck.faction")}),l=(0,t.CO)(o),u=(0,t.NJ)(),d=(null===c||void 0===c||null===(n=c[l])||void 0===n?void 0:n.units)||{};return(0,i.jsx)("div",{className:"arsenal d-flex justify-content-center pb-2 w-100",children:Object.values(d).map((function(e){return e.map((function(e){return(0,i.jsx)(s.ZD,{className:"m-1",name:"players.".concat(a,".deck.units.").concat(e),children:(0,i.jsx)(r.Z,{src:"".concat(u,"/units/").concat(e,".webp"),fluid:!0})},e)}))}))})}},6601:function(e,n,a){a.r(n);var r=a(9439),t=a(2791),s=a(2592),c=a(1694),i=a.n(c),o=a(8530),l=a(184);n.default=function(e){var n=e.player,a=e.reverse,c=(0,o.s3)({type:"variables"}),u=(0,o.NJ)(),d=+(0,o.CO)("".concat(c,".players.").concat(n,".score"))||0,f=(0,o.CO)("".concat(c,".players.").concat(n,".deck.faction")),m=+(0,o.CO)("".concat(c,".series.game.max"))||3,p=(0,t.useState)([0,0,0]),v=(0,r.Z)(p,2),x=v[0],h=v[1];return(0,t.useEffect)((function(){var e=Math.floor((m||1)/2)+1;h(Array(e).fill((function(){return 0})))}),[m]),(0,l.jsx)("p",{className:i()("score d-flex",a?"flex-row-reverse":"flex-row","mb-1"),children:x.map((function(e,n){return(0,l.jsx)(s.Z,{src:"".concat(u,"/overlay/game/points/").concat(f,"-").concat(d<=n?0:1,".png")},n)}))})}},3744:function(e,n,a){a.r(n),a.d(n,{Deck:function(){return r.default},Scoreboard:function(){return t.default}});var r=a(1019),t=a(6601)},6467:function(e,n,a){a.r(n);var r=a(9743),t=a(2677),s=a(3982),c=a(3754),i=(a(1468),a(184));n.default=function(){return(0,i.jsxs)(s.xs,{id:"replay",className:"w-100 h-100",children:[(0,i.jsx)(s.Ee,{className:"position-absolute w-100 h-100 z-n1",name:"map",src:"maps/:var:.jpg"}),(0,i.jsxs)("div",{className:"players position-relative d-flex flex-row justify-content-between align-items-start",children:[(0,i.jsxs)("div",{className:"player left position-relative d-flex flex-column justify-content-between align-items-center h-100",children:[(0,i.jsx)(s.Ee,{className:"commander position-absolute left-0 z-n1",name:"players.1.deck.commander",src:"commanders/transparent/:var:.png"}),(0,i.jsxs)("div",{className:"plate position-relative d-flex flex-column justify-content-end align-items-center w-100",children:[(0,i.jsx)(c.ReplayScoreboard,{player:"1"}),(0,i.jsxs)("div",{className:"player-name position-absolute top-100 left-0 d-flex flex-column align-items-center text-uppercase w-100",children:[(0,i.jsx)(s._w,{name:"players.1.displayName"}),(0,i.jsx)(s._w,{name:"players.1.alliance"})]})]}),(0,i.jsx)(c.ReplayDeck,{player:"1"})]}),(0,i.jsxs)("div",{className:"player right position-relative d-flex flex-column justify-content-between align-items-center h-100",children:[(0,i.jsx)(s.Ee,{className:"commander position-absolute left-0 z-n1",name:"players.2.deck.commander",src:"commanders/transparent/:var:.png"}),(0,i.jsxs)("div",{className:"plate position-relative d-flex flex-column justify-content-end align-items-center w-100",children:[(0,i.jsx)(c.ReplayScoreboard,{player:"2",reverse:!0}),(0,i.jsxs)("div",{className:"player-name position-absolute top-100 left-0 d-flex flex-column align-items-center text-uppercase w-100",children:[(0,i.jsx)(s._w,{name:"players.2.displayName"}),(0,i.jsx)(s._w,{name:"players.2.alliance"})]})]}),(0,i.jsx)(c.ReplayDeck,{player:"2"})]})]}),(0,i.jsxs)(r.Z,{className:"bar position-relative w-100",children:[(0,i.jsx)(t.Z,{className:"d-flex justify-content-end align-items-center",children:(0,i.jsx)(s._w,{className:"text-uppercase",name:"series.round"})}),(0,i.jsx)(t.Z,{className:"d-flex justify-content-center align-items-center",xs:"auto",children:(0,i.jsx)(s.Ee,{src:"overlay/logo.png"})}),(0,i.jsxs)(t.Z,{className:"d-flex justify-content-start align-items-center text-prewrap text-uppercase",children:["Game\xa0",(0,i.jsx)(s._w,{name:"series.game.current"}),"\xa0of\xa0",(0,i.jsx)(s._w,{name:"series.game.max"})]})]}),(0,i.jsxs)("div",{className:"map position-absolute d-flex flex-column align-items-center left-0 pb-5 w-100",children:[(0,i.jsx)(s.B7,{className:"position-relative",name:"countdown"}),(0,i.jsx)(s.Ee,{className:"position-relative",name:"map",src:"maps/preview/:var:.webp"})]})]})}},2592:function(e,n,a){var r=a(1413),t=a(5987),s=a(1694),c=a.n(s),i=a(2791),o=a(2007),l=a.n(o),u=a(162),d=a(184),f=["bsPrefix","className","fluid","rounded","roundedCircle","thumbnail"],m=(l().string,l().bool,l().bool,l().bool,l().bool,i.forwardRef((function(e,n){var a=e.bsPrefix,s=e.className,i=e.fluid,o=e.rounded,l=e.roundedCircle,m=e.thumbnail,p=(0,t.Z)(e,f);return a=(0,u.vE)(a,"img"),(0,d.jsx)("img",(0,r.Z)((0,r.Z)({ref:n},p),{},{className:c()(s,i&&"".concat(a,"-fluid"),o&&"rounded",l&&"rounded-circle",m&&"".concat(a,"-thumbnail"))}))})));m.displayName="Image",m.defaultProps={fluid:!1,rounded:!1,roundedCircle:!1,thumbnail:!1},n.Z=m},9743:function(e,n,a){var r=a(1413),t=a(5987),s=a(1694),c=a.n(s),i=a(2791),o=a(162),l=a(184),u=["bsPrefix","className","as"],d=i.forwardRef((function(e,n){var a=e.bsPrefix,s=e.className,i=e.as,d=void 0===i?"div":i,f=(0,t.Z)(e,u),m=(0,o.vE)(a,"row"),p=(0,o.pi)(),v=(0,o.zG)(),x="".concat(m,"-cols"),h=[];return p.forEach((function(e){var n,a=f[e];delete f[e],n=null!=a&&"object"===typeof a?a.cols:a;var r=e!==v?"-".concat(e):"";null!=n&&h.push("".concat(x).concat(r,"-").concat(n))})),(0,l.jsx)(d,(0,r.Z)((0,r.Z)({ref:n},f),{},{className:c().apply(void 0,[s,m].concat(h))}))}));d.displayName="Row",n.Z=d},1468:function(e,n,a){a.r(n),n.default={}},3657:function(e){e.exports=JSON.parse('{"GDI":{"commanders":["Jackson","Liang","McNeil","Solomon","Strongarm"],"units":{"barracks":["Riflemen","Missile Squad","MG Squad","Jump Jet Troopers","Shockwave Troopers","Sniper Team","Grenadiers"],"vehicles":["War Dogs","Rhino","MSV","Pitbull","Shatterer","Slingshot","MLRS","Predator Tank","APC","Battering Ram"],"aircraft":["Drone Swarm","Talon","Mohawk Gunship","Razorback","Orca","Hammerhead","Orca Bomber"],"tech":["Wolverine","Disruptor","Juggernaut","Zone Troopers","Kodiak","Sandstorm","Titan","Mammoth Tank"]}},"Nod":{"commanders":["Seth","Kane","Jade","Oxanna"],"units":{"barracks":["Militants","Laser Squad","Fanatics","Scavengers","Flame Troopers","Scarabs","Chemical Warriors","Mutant Marauders"],"vehicles":["Cyberwheels","Attack Bikes","Buggy","Chemical Buggy","Scorpion Tank","Tick Tank","Giga-cannon","Stealth Tank"],"aircraft":["Laser Drones","Banshee","Venom","Catalyst Gunship","Shade","Inferno","Phantom"],"tech":["Widowmaker","Flame Tank","Centurion","Confessor","Artillery","Basilisk","Rockworm","Cyborgs","Avatar"]}}}')}}]);
//# sourceMappingURL=6467.fc535749.chunk.js.map
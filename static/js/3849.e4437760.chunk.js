"use strict";(self.webpackChunkclient=self.webpackChunkclient||[]).push([[3849],{3849:function(e,n,t){t.r(n);var r=t(9439),a=t(1087),u=t(3982),c=t(184);n.default=function(){var e=(0,a.lr)(),n=(0,r.Z)(e,1)[0];return n.get("name")?(0,c.jsx)(u.Ee,{className:"mw-100 mh-100",name:n.get("name")}):null}},3982:function(e,n,t){t.d(n,{Ee:function(){return v},xs:function(){return m},B7:function(){return p},ZD:function(){return h},_w:function(){return E}});var r=t(1413),a=t(9439),u=t(2791),c=t(1091),i=t(6928),s=t(1694),f=t.n(s),o=t(8530),l=t(184),d="1x1.png",v=function(e){var n=e.name,t=(0,o.s3)({type:"variables",name:n}),s=(0,o.NJ)(),v=(0,o.CO)(t)||"",m=(0,u.useState)({}),Z=(0,a.Z)(m,2),p=Z[0],h=Z[1],E=(0,u.useState)(d),x=(0,a.Z)(E,2),j=x[0],N=x[1],g=(0,u.useRef)(null),R=function(e){console.warn(e),N(d)};return(0,u.useEffect)((function(){var n=e.src;N("".concat(s,"/").concat(n.replace(/:var:/,v)))}),[e,s,v]),(0,u.useEffect)((function(){var n=e.className;h((0,r.Z)((0,r.Z)({},e),{},{className:f()("variable",n),onError:R,src:j}))}),[e,s,j,v]),(0,l.jsx)(c.Z,{children:(0,l.jsx)(i.Z,{addEndListener:function(e){return g.current.addEventListener("transitionend",e,!0)},appear:!0,nodeRef:g,children:(0,l.jsx)("img",(0,r.Z)({ref:g},p))},v)})},m=function(e){var n=e.children,t=e.className,r=e.id;return(0,l.jsx)("div",{id:r,className:f()(t,"overflow-hidden"),children:n})},Z=t(6707),p=function(e){var n=e.name,t=(0,o.s3)({type:"timers",name:n}),c=(0,Z.J)({path:t}),s=c.active,d=c.text,v=(0,u.useState)({}),m=(0,a.Z)(v,2),p=m[0],h=m[1],E=(0,u.useRef)(null);return(0,u.useEffect)((function(){var n=e.className;h((0,r.Z)((0,r.Z)({},e),{},{className:f()("timer",n)}))}),[e]),(0,l.jsx)(i.Z,{addEndListener:function(e){return E.current.addEventListener("transitionend",e)},appear:!0,in:s,nodeRef:E,children:(0,l.jsx)("span",(0,r.Z)((0,r.Z)({ref:E},p),{},{children:d}))})},h=function(e){var n=e.children,t=e.name,c=(0,o.s3)({type:"toggles",name:t}),s=(0,o.CO)(c)||!1,d=(0,u.useState)({}),v=(0,a.Z)(d,2),m=v[0],Z=v[1],p=(0,u.useRef)(null);return(0,u.useEffect)((function(){var n=e.className;Z((0,r.Z)((0,r.Z)({},e),{},{className:f()("toggle",n)}))}),[e,s]),(0,l.jsx)(i.Z,{addEndListener:function(e){return p.current.addEventListener("transitionend",e,!0)},appear:!0,in:s,nodeRef:p,children:(0,l.jsx)("div",(0,r.Z)((0,r.Z)({ref:p},m),{},{children:n}))})},E=function(e){var n=e.name,t=(0,o.s3)({type:"variables",name:n}),s=(0,o.CO)(t)||"",d=(0,u.useState)({}),v=(0,a.Z)(d,2),m=v[0],Z=v[1],p=(0,u.useRef)(null);return(0,u.useEffect)((function(){var n=e.className;Z((0,r.Z)((0,r.Z)({},e),{},{className:f()("variable",n)}))}),[e,s]),(0,l.jsx)(c.Z,{children:(0,l.jsx)(i.Z,{addEndListener:function(e){return p.current.addEventListener("transitionend",e,!0)},appear:!0,nodeRef:p,children:(0,l.jsx)("var",(0,r.Z)((0,r.Z)({ref:p},m),{},{children:s}))},s)})}},6707:function(e,n,t){t.d(n,{J:function(){return i}});var r=t(9439),a=t(2791),u=t(8530);function c(e){if(!e||e<=0)return"00:00";var n=new Date(e).toISOString();return e>=36e5?n.slice(11,-5):n.slice(14,-5)}var i=function(e){var n=e.path,t=(0,u.CO)(n),i=(0,a.useState)(0),s=(0,r.Z)(i,2),f=s[0],o=s[1],l=(0,a.useRef)(null);return(0,a.useEffect)((function(){o(t>0?Math.ceil(t-Date.now()):-1),t||clearTimeout(l.current)}),[t]),(0,a.useMemo)((function(){var e={active:f>=0,text:c(f)};return clearTimeout(l.current),f>=0&&(l.current=setTimeout((function(){return o(f-1e3)}),1e3)),e}),[f])}},8530:function(e,n,t){t.d(n,{s3:function(){return u},NJ:function(){return c},CO:function(){return f}});var r=t(2791),a=t(7689),u=function(e){var n=e.type,t=e.name,u=(0,a.UO)().code;return(0,r.useMemo)((function(){var e=[u];return n&&e.push(n),t&&e.push(t),e.join(".")}),[u,n,t])},c=function(){var e=(0,a.UO)();return"./".concat(e.code)},i=t(9434),s=t(4074),f=function(e){return(0,i.v9)((function(n){return(0,s.nZ)(n,e)}))}}}]);
//# sourceMappingURL=3849.e4437760.chunk.js.map
var content = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const DOWNLOAD_ICON_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 21H18" />
    <path d="M12 3V17" />
    <path d="M12 17L17 12" />
    <path d="M12 17L7 12" />
  </g>
</svg>`;
  const SUCCESS_ICON_SVG_RAW = `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<rect width="160" height="160" fill="url(#pattern0_1_2484)"/>
<defs>
<pattern id="pattern0_1_2484" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0_1_2484" transform="scale(0.00625)"/>
</pattern>
<image id="image0_1_2484" width="160" height="160" preserveAspectRatio="none" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAAgAElEQVR4Ae2dCXhV5bX310nISMh4hiSoV2trhcoDaul3awv6VavX1tT2FrVe+/W297b3Xu0Vej+10esU5lEIQxJmEIhlkDlkngdCEiSMAiKzRfBW8GurFWv9f8//3ftNNjFIhn1OTsLez7NyjJycvd/1/+213rX2u/cRCcSWIeHygu8GyfDdIy95ngzJcGe7MtybXBm+SleGd4crw7vTNdbX5MpoY/x/jnXfB+35lT5XvqcG7k3URF70jJaXvN81tJLwQKDhv308G5cgL3nvC3nZM971sqfAleE96Rrr/YtrnA+u8aZN8MI1wQfXxMvYJB9cjnXfB5fzL31PDbQe1Gas92Ol1cueAmpHDYVa9prtxaThQugyPE2usd6LrvGEzAvXRC9ck71wTfHBNdW0aT64tE33waVthg+utqb/zXlt9dMX+aKt//i79f3a73zVelAbakStFJheAnmRWlJTobZBu73ku1syvKtkrPd9Ge+FTPRCJnshU7yQaT7IdB9khg/yig8y0weZlQzJTIbM9kFm89W0OckQx/znA+1n9eozNKAW1ITaUCNqRc2oHTWkltSU2lJjah0024ueWyXDs1zGej+UCTxgHrg5gBkcmAYtGTI3GTIvBZKVAslOgeSkQOa3sQUpkLa2MBXiWOd90NaP/L2tv6kDjZpQG2pEOBkcqB01VDD6DG2pMbWm5tS+x7YMT4y87HlWxnreMcBjpPMaZxDPJg6CkSwruRW0hSmQRSmQJSmQpbRUyLJUyHKrDYS86phffLB84KW+pu+pAbWgJtSGGhFSBgdqRw2pJTVldKTGjIoKRM87ioHfugcElkOSP9ZTKOM9xsEo8LyQWT7IHJ8JXbIRyRabsC1LgbyaClmRClmZAlnpg6z0QFYmQVYmQFbGG7YqAeKY/3yg/Ex/0+h7akAtUgxtqBG1IpTUjlEzxwwk1JYazzCDDUEkA2QhYNEww/0TGec5ruYFUxnxNHjJkGwTOhXlzKhG4HIHQnKTIbluSG4C5Hdu9Ft3DeI23Yxr8m7HVwu/jSHF/xvDSr7jWAB8MKT4Lny14FvK99SAWlATpY3SiFoNNIBkdlqSakRHwkiNGRU1iGSAc0QyQTb8uo31PiPjPR+qEMyox7Cs0ywPjmcMwzqhWzUQ8juaF/K7RMg6Hzxbb8Hw8vvxUOO/47/2vYxxhzIx8+2FmHd8OeafWIWFJ3MdC4AP6Gv6nL6nBtTi4cb/UNpQI2qlNFPaDTS0pKbUVkdFnZ7JgE7LZIOM+GXLcI+VCR6jMmLUy/RC5vmM8MyIx5DN8L0q1QBvjQ+yJgGRm67HbeXfxb80/19MOjIXC0+uwvJ31ipbeno1Fp1+DQtPrcICxwLqg4WnVynfUwOlx+m1ShtqRK2oGbWjhkItGUyoLTWm1tScqZkMkAUywaqZjJAVW7e28LF1kuWDLEg2Jq+vpljAS1EHHbHpOtxR/QCePjAW2SdfxdJ3VoODzjq5DHNPLsEc2qklmHtqqWM96ANqQC2oCbWhRtSKmlE7akgtDRBTLCCahQsZIAtkwi8QjnM/LRM9EOb6V7yQ2V5jHsBqiZNVTl5fS4WsHQhZ64Ws92BQ2QiM3v+iGsTC0yvVAGedXIhWW4RZJxdh1inHgsIH1EJZq0aEktoRRGpJTamt0phaU3NqTwbIAueGZIOMqHkhixP3U90LhBmeUTLR/ZFM9RgfPMcLyfFBFiVDljPqpUBWp0LWpUJeT0T/rdfjwcZ/xoxjOcg59SpmnliA6SdyMP1kDmbQTl3GTudghmOB98Hl9DhpaEbtqCG1pKbUlhpTa6U5tScDZIFMkA0yoiD0QLEz1vNQ1yAc5x0qE9ynWuCba8K3OBnyKqskplqClwJZn4iUoiF4fF+6CuUzT+RgyvG5mHJiLqactNipuZhitdNzMaXF5mHKaccC5wOL762a8L+tmlHD43NBTZmmqTG1lvUJhvZkgCyQCbJBCMlKK4SnhSx1amOTeYKnWKa6ITO9BtXzfcYOuKPXUiBrUyEbUiAbE3Fj+f/Cbw+Nx6yTCzDpeCYmHJ+FCScyMeGkxU5lYkJbO52JCVZr++/O75/3mR0+sfqc/93eZ1q1o5bHZyltqfFvD43Dl8q/obRXDJAFMqEhJCuMhGSHDJElMtXhbXxSukxxX5p2WyIf53smfJsS8ZWKv8ezhydg2ol5yDg2HRnHpyPjhGknZyBD26kZyHCs9/hA68ZXrSe1PTZdaU3Nqb1sSjQCEZnIZZVsiYQ6HZOlCUnPdoy/cb4hMsl9TmZ4zIKjTeTjfG9jKmRTEq4rvx1PHc7AxOOz8PzRyXjh2GS8cHwyXjgxpdVOTsELVjvV5nf9b/z/jgXOB9rv1tf2tLFqSW2PTVZaU3NqTwbIgmKCbFgjYTarY7ZoPFBMka0v3DIkRMZ7XpVpHqO3w/JaFRzmnI+UbxwI2exGYvEg/PuBZ9QZkf72eKQfHY/0Y6Ydn4B0bScmIF3byQlIp+nfndfg8kV7+mgd+ar1pdZvj1fakwGyQCYUGyoSsjBJNtghQ+wTkimyRcYuu03wjJQp7o9kpgcyzwtZ4IMs80FWJUPWpEA2pEI2exFecA1+3PyvePHtyXjqyEt46u2X8NTRl/DUsZcNO/4SnnKs7/lA60utqfmRlxQDZIFMkA3FCFkhM2SHDJElMkW2yFi7G8mc5F4lM9yQ2R7IfC9kCS9SJ0NWs9JNgWxJgeS58Y0d9+OZIxkY89bzGH3kOYx++zmMPvrfhh37b4x2rO/6QOtMzY88pxggC2SCbChGyAqZITtkiCyRKbJFxtqNghPdt8kU9wWZ5YbM80AW+SDLfZDXkiHrUiCbUiBb3fCW34JfvfkbjH7rOTx++Gk8/tYzePzIM3j8bYsdfQaPO9b3fGDVmJpT+8NPKxbIBNkgI4oVMkN2yBBZIlNki4yRtc9tk5ImynQ3ZI4HkuOBLGXq5fXcZKPK2eJDSH4y7tk5Cv956Lf45cEx+OXh3+CXb5l25Df4pWNXjw+07mTg4BjFBNkgI7LFZzBDdsgQWSJTZIuMkbVLtslxCTI1sVlmuiFZjH5eyKtcxeKDvJ4M2Wyk3msqh+Hn+3+NX7z5n/jZwSfws8MWe+sJ/Myxq8cHVu0PPqGYIBtkRKViMkN2yBBZIlNki4yRNTLXsk1OvFemJ30is92Q+Yx+Xsgqr7EKYmMyZKsPrgIfRjalqR09euBXePTgv+HRQ6Yd/jc86tjV5wOtP1k48CvFBhkhK2RGyA5X0pAlMkW2yNj0pL8KmWvZpiSNl1eSjDy90HNp9GPhsc2NxPKb8aM9P8MjB/4Vow78HKMO/sKwQ7/AKMeuXh9oDg78XLFBRsgKmVEFiTUKki3OBckamVPbAgmTaUnFkpkEyfZAlnCJto5+PkheMiTfjUHbv4WH9v0cD+57DA8eoP0UD775Uzx40LGr2gdkgCyQiX2PKUbICplR7GxkHcFuCrsqHoMxskbmyJ5Mj7tBpieekrluyAI3ZJkH8poX8roPsjkZss2L0OJU3NF0P36w959w/76Hcf/+R3D/Acd60gffO/AI/GVdGheZ2PewYoSskBmyoxgiS2SKbJExskbmyJ5MS7xXZiZ+IlluyCI3ZIUbspoNReZxI/rFld+I7+x6EPft+THu2fsj3LPvH3HPfsd60gd3H/gh7jyUZpuNPJSGb7/5fdy1/wf4ble0JRN7f6QYIStkRkVBMkSWyBTZImNkjcyRPZmW9KRkJkJykiBL3JBVHsgaL2SjF5LngxQmIbX6Fnyn+Qe4a3ca7tyThjv3puHOfY71hA/u2peGkfsfwJ17H8AD9Y8greYneKD2EaR1wx6oeRjfq3kIDzX8HD/a938wcv/3O68vmdiTphghK2SG7CiGyBKZIltkjKyRObIn05OyZHYiZH4iZBnvjPJAXvdCNnmNEFrkwQ11t2Pkru/hjub7cMfu+3DHnvtwx17HesYH/4DbDtyFx6p+hZzFOchalIPspdnIXsrXzlvWkmzkLFuA1zetR93OevzH/v/CrXvv7Ly+ZIJsNN+HO3d9TzEjRR6DIbJEpsgWGSNrZG5GwjyRVxI2ypxEyMJEyHK3cXsel15v8ULyPZBiH26q/wa+ueu7GL7rbgxvvhvDd9+N4Xsc6wkfDN07EnfsuhcL8hdjZ3kTDuw+gMP7DuHQvoNdtEM4+fZJfPbB31DwXglu23MXbt19Z+f1JRNkY9fdihUyQ3YUQ2SJTPHWTzJG1sgc2ZOZCRUyLxGyKAmyIgmy2gPZ4IFs9UIKPAgtTcZXd3wDt79xF4btGolhzSMxbLdjPeGDobtH4it7h+PXVU+huXYXLrx/HnZt5z+7gB8e/ilufOM2DNt9Z9c0Jhu7RipWyAzZIUOKJTJFtsgYWSNzZE9mxtVLFgFMNAF0Qza4IVs9kAI3+pWm4Cv1X8eQpm/hazu/ia+98U18bZdjPeGDG5tvxR077sP60g04c/T3+PTTT+3iDzN+Pw8DGwdj8K6/77q+ZGPnNxUrZIbskCHFEplazSKXACZCMUf2ZGZik2QlQJYkGo9qWMN1XR5IngdSaAB4w/ZbcXPjN3BT03DctHM4bnrDsUD74Mtv3I5r3xiC58pexqHGN/GnP/3JNvh2/3kfhjR/G9c23dI9bclG03DFCplRABayH+gxmCJbfBwIWSNzZE8y45skmwDymSxJkLVJxgpXLq0hgGXJuG77EHy58TZ8qfFWfKnpVnxpp2OB9oF311dxV+0DKCkvwbnT5/C3v/3NFgA/+ewT/MuRJxG/44bu60o2Gm9VrJAZskOG1LVhrpomW2SMrJE5sqd+5CRAliZCcjWAbuNSShEB9CG1bhCu2zEE1zbcgmsbb1FnCs8WxwLjg5SmQUhpHISpJa/g2O6j+Oijj2yBjx+y7g+b4W74MpIbb+6+nmSj4RbFCpkhO1JksrTJbQBIxsgamTMAjGuSnHjIsgRILu/3TDQiIK/lFSUhtNwLT+1NSK0fhJQdNyOl4WakNDoWOB8MQv+ma/D9yodRX1WP98+9j8/wmS0AnvvkPdyx9x8QvT0VqY2EvJu6ko0dNytWyAzZIUPqujAjINkiY2SNzGXGMQLGNcl8E8DXEo2bjvlmAlhsAJhUeyO89TfBU/8VeBocC6QPYhv/Dqn1g7GgeDFOHzyFixcv2gIfPyTj1FT0q/OoCGjbmOq/olghMwrAYguAvKGdjBFAMndZADcnGZdRipMQUuZBXO3fIbH+S0iovwEJDY4FygfxDdcjtMGDx8p+ib11e3Dh/AXb4Gv6U7NK6xHbk+3VtP4GxQqZITsMYuqSHJm6PIBxkGXxkNd4t3siZHMiJD9J/bGrzI3+Ndcgtu5aDNh+LQbUOxYYH1yH0AY3rq8einUlr+Pdo2fw10//aguALDx+fPCfITUxiK2/zl5Nt1+rWCEzZMcAMMlgSgGYYLA2P05HwNgmydEAxkPWJUA2JUC2JUKKEuEqS0JkVSqiawciqm4gorY75m8fRG8fiIjtKZDtCXiy+Gm81XjY1rbLqvfWIaw2EWF1XnBfto6nbqBihcyQHTKkWCJTZOs1TvfioZjLjOUcMLZJSCP/Z247AJYmIrzSh4iaZETUJiOizjF/+yC8LhlSH4NbKr6J4rISvGdj2+XMxbMYsusOSHWUgtz2sZCRmmTFjKvUCGKXAEjGyJqKgArAAU0yPxayLA6SGwdZFw/ZFA/ZlgApSoCrNAGhlW70q/GgX61HTVo5cXXMfz4I2Z6AfrUJGFc0CSf2HLe17fLsibGQqn4IqXP7R0MyUuNRzJAdMqRYIlNki4yRNTKXOYARkAAOgCyLNQGMg2yKg2yLhxTFQ0rj4apMhKs6Ca7aJLjqHPOrD2qTINvDMLLsPtRX7bC17dLwxybE1w9U0S/EXzqSEbJSmajYUQyRJTK1zgxyZI3MdRRAqUiAVCVAahIgtY751Qd10Yip8iKnaAHeOfgOPrap7XLxbxeR9ubDkAqB1Cb6T0cyQlbITKkZxK4IYM4XR0AHwECddPGQulCMKn4Me+v24oPzH9hS9fJDVpx7DSHVEary9esJ1FEAyVxLBFQADoDkxkLWxZopOA5SFAcpjYNUxEOq4iE18ZBax/zjgwRIXTiSK2/EmpJ1OHvsXdvaLmcuvovBb9wOqXSZkc+PGpIRskJmyA4Z2mZO68gWGVs2APJ5AGMguQMg6waYAMZCimIhpbGQijhIVRykJg5S65j9PiAQAyC1YXii6Dc40vSWrW2X9OMvGqm3Jtb/+pERskJmyA4Z2mYGNbJFxpbFWAHs3yQ5MZClJoBrB0A2xkLyYiGFsZCSWEh5HKQyDlJtQsidOGavD2pDMKjsNrPt8p5tq11U4VHng1SFGxnM37qREbJCZsgOGSJLZIpsEUCyRuYy+7MKdgDs8ZOpNhqh1f0xtmgCTuw5YVvb5eJnF5F24CFIudh7snwRxF0DsL8ZAWMga2MgGwdA8gZACgeYETAWUhkLqY6FMIw7Zq8PagUjSr+LHTa3XVacy0UII191lL3H+0X6kxGyUm5mTzJElsgU2co1s21Of2sEdADssZOqNhwxVUnILlqA39vYdlGFx85bzbkfp0wBChydBzC6SXKiIUv7Q3L7Q9b2h2yMgeTFQApjICUDIOUDIJUDINUDIDWO2eeDGEitYFTxo9i73d62S/rxF8zU2z+wmpERskJmyA4ZIktkimyRMbJG5jKjOQeMapKcKMjSaEhutAlgf0hef0hhf0hJDKQ8BlIZA6mOMfpINc4rV5J0z1j1hiC54nqz7XLWtrZLwx8bEV/nhVSFmvB191g78fdkhKyQGbJDhsjSRjO4kTGyRubInmRGmgBGQXKjTACjIXnRkMJoSEl/SHl/SGV/SDXPJse67wMKynmZC08UjcaRnfa1XVThsf/HlugXYL3ICFkhM2SHDJGljWZwI2NLo0wAI00As6MgS6Igq6Iga8w3b42GFERDivtDyvpDKvpDqkwIuRPHuueDGsGg0qEoLivGe6fta7usOJuLkMowo+3SExqREbJCZsgOGSJLBJBskTGyRuYY/NQPB8DuwdRZoWvCEVoVgbFF421tu6jCo2moEf06e0x2vb9rAEZClkSaETAKsjEKsjUKUhAFKY6GlEVDKqIhVdGQase67YMawYiS72BHtb2rXdKPPQ8pE0h1ZM/pREbICpkhO2SILJGpNWaWJWvZkdYISAAjHAADcXLVhCKmMh7ZRfNtbbuowqPWDalw9Rx89F+HAIxoC2CECWAkZE0kZGMkZGukGQGjIGVRkIooSFWU0dRkY9OxLviAkYltl0dsbbuowmPfj8zo18PakBGyQmaKzSxKlsgU2VplBrvsCDMCzgpvkqxwyOIIyMoIyOoIyIYIyJYISH4kpCgSUhoJKY+EVEZCqhzrmg8IhiC57FqsKVmLs8fsa7usOLsSIRX9IJX9el4fMkJWyAzZIUNkiUyRLTJG1sgc2VM/HAADIFw4pErwROGTtrZdzlw8g8GNQ4zoFwzBofMAhpkRMByyMhyyOhyyIdyMgBGQoghIaQSkPAJSGQGpcqxLPqhm22WI7W2X9KPPmfCx9RIE2pARskJmyE6+mU3JFNkiY4vDzQgYxgjYHoBhDoB2ilkdgtDKMIwtHGdr20UVHjVJxvVeO4+3O591WQDDvgjAMMjiMMhKvikMsoEAhkPywyFF4ZDScEh5OKSSacSxzvkgTM39RhTfZetqF6Pw+CGkVCBVZuM5GLQhI2SFzJAdMkSWyBTZImNkLSsMKvjJrH5NktUPsrgfZGU/yOp+JoBhkPwwSFEYpDQMUh4GUR12DtaxDvugWhBTEWu0XQ7Zd5ORUXiEQipDgksPMkJWyAzZIUNbzKBGtsgYWSNzZM8B0J8nUz+j7VL0kK1tF6PwuMUy9/PnGDr52Z0GcGZok2SFQBaHQFaEQlaHQtaHQjaHQraFQgpDISWhkLJQSAXPOMc67IMqQXJpKtYU29t2ST/6rJF6Gf2CTQ8yQlbIDNkhQ2SJTJEtMkbWyBzZUz8+B2AIZHMIZFsIpDAEUhICKQuBVHDAjl3ZBzxJXZBKwRMFv8aRnUdsu8mo4f81IL46wbjeq+ALMj3ICFkhM2SHDJGl9SEdAZBvMt/sANi9k61KMKhksNF2ecee1S7q5vK9P4CUSPeOzZ9B5AsBZJY1s21rBHQ1SZYLstgFWeGCrHZB1rsgm12QbS5IoQtS4oKUuYzrjOrM5tndUaOzeIHcZqvi53b0GAL9PkFoRajtbZcVZ1cgpJyZKIjHzmvRZIXMkB0yRJbIFNkiY2SNzM10MQVLk2QJZLFAVghktUDWC2SzQLYJpFCMM46rLNTATaAIVQcsqioa8WXxCC8KR0RxJCJLohBVEqVe+d+dNf5tVAlXXLD90LFj6Mhx2vqeKsGIopG2tl1U4dEw2Jz7Bem4yQN1ISuM0mSHDJElMkW2yBhZI3Nkz68AVgiurb0WS5qWYEneEry8/GU8v/h5017A84s7by8segHjFozHfa/fZ0TVYIOwShBTFoPswhz83sa2S/rR9OCHLxgBDC0LxbMHnwXOQz1sZ9+OfWiubcbuLhr/tqmoCWvWrcXNRYOMKNiFyGxrxNOZwDyOUYWjbG27GIVHvBFZ9L6C9bXTEfAVaZJ5AlkkkFcF8juBvN4mBRebYZU3OHMHnbEyQXRlNPIv5KsH7fD57n/99FN1Aw4fOdtZ47cD/fGPf8SRN97GtK3TEcWFj/rM68xx+eO9lYLkkhRbV7uoKx570yDUwB/HbPdnkhGmYB6vNQWTKbJFxsgamSN76oc/AeQASwTDGofh7CdnbXva0/k/nEdzVTN+su3R4AGwwv62y4p3VyCEbY2unPx2w9WRzwtKAHlQxYIxb42xDUBGzjPHziCvMA+DmIp7OgpWCgYVD0JxeTHes6ntogqPHYONCX1HxA+G9wQlgHRMmSCyIhJ5f8izDcIPP/oQx5qPYVpez6fi0HL72y6q8OgtqVfDH7QA8gB1Kr5oXyp+/w/vt6Zi7YQeeB1RNMLWtosqPPicPa526YHxdHmfXQJwrkAWCmS5QF4TyDqBbBJInkAKBFIkhiM4ueQOumNFfkzFhYMMsbpzfF3425jSGGQX2dd2UYXHnjTD7104nm7p0939kRGeNGSG7JAhskSmyBYZI2tkrqUICSSApYLIcj+lYlbFpWaTuruO7MTfjyqwt+2iCo9SXlPt5sneiTHYBm3QA0inFAuGNQzDWX+k4rxHAxcFKwTJxSm2rnZRhUf9YKON0RMAdXefvQJAHqS/UnFBHgYFMBXbvdol/e10I331xuhHeHsFgDzQEkFkWSTy/scPVbFOxdoh3T2rL/P3bP/Y2XZp+KAB8ZXxRtvlMvu0LVX66/M7DeB0aZI5AllgThBzBbJWIBsFslUg+ZYFCZxccgd2WaFg6I6h/knFWx81iiW7jrXN54SWhmJsgX03GanCY3eacfWgzb5s83cgPpeM6IUIZIcMkSUyRbZYhJA1Mkf21I+eApAHWygYc9gPDWqm4oJBfoNwRKG9bRdVeHARp90neSCgs+6jVwHIAy8WRJb6MRVz6RbTjdVJ3fzvmBJ7V7uowmP74Na5XzePz86xdvqzeh2AdHYvS8V2t11U4cEL9709+lHLXgkgD7qXpGLVdrHx2S6q8OC3CukVR705+vVaAHngrIp7QSq2s+2i7vHoC4WH9aTplRFQD4CpuN6PVbHeTxdf2V9Uj9S1abXLijMrEFLMO8jsnaN2et7WRX+0u58uAzhfIMsEskogawSyQSBbzDX9vKbHFEFHcQf+Mn5+gZ+rYjq7C8cfWmK2Xfba801GZz4+g8EsPOjbLhxP0P4NNSQrHBfvByFDZIlMkS0yRtY+14YJBgApRJEgssSPVbF65HDnRR9RMMLWR+qmH0k3RPL3SR1ouHs9gHRYQQBScSeEiSm2t+2iCo9yfplz50+EoI182p99AkAOIohS8ah8+1a7tFzx6Gupt08ByMH4ORVHF0Ubc68rpMDkQntXu6jCoyjEmCdp0frSa6cj4DRpktnmxHCpQFaaE0Z9czoXFPKaHtOFLkS4k0BYvmDodj9UxdXNeJTXiq80hmLBE/n2PdtFXfGoG2z480r77q3/TkbICpkhO/qmdBYhZIuMsd4gc2RP/QhWADmYfMGYQ364VsybmbYNao2C7QjOa8l2tl1U4UFhAn0itzO2K558Xf2bPgUgnVAoiCz2T1U8fet0XJKKLU4PLQrF2PxxOGFT26Wl8NCPOrHsy28w9MQ++hyAdGIPpOIR+fatdlGFR3Na3069GvY+CSAHtU0w5qB/UvFgnYq5nxJBTKG9bRdVePBZeZwbaaH66muXAMwUSI5AlliekMVHKfBuJi4o1E/J0oUIdxJoKxBEFkUi7z37V1BP32KmYkJRLBi1zb62i7riUTvY8GGgfdYT+yMj+pEcZIcMkSX9ZCwyRtbIXEsR0hsApDO3CYbWDcXZj+28r/g8dvERH5t/oqKTJ9+LNUVrbPsmo/S30g34evLkDSSIfRpADs4fqfj4u9iwbQO+vPHL+Onmn+JQ42FbHqmrCo+yeOOSWyAh6Ml99WkA6Vh/pOIPP8Th/YeRW5yLwpoinDvT/UfqqsJjV9rVk3o19H0eQA5Up2Kb7iv+7LPP8Oc//xnn3z2PC/9zAR9f/Ljbz69RhUeBWXhoca6G104DOFWaZJZAsi1FCJ/jxkcp8G4mLqfRj+jg5JI7CAbbam9VTOI+A59e2P2tpfCg34LBV4E8BjLC69wcO9khQ2SJTPHxvCxCyBqZI3vqR28EMF8QWWhvVdx99IxPSD+cbggQTCdsoCC8agCkQ/PMqtimVGwHgKrwKI03ms6BEj2Y9nNVAcjB+iEVdxVEVXi8kWZEv2CCIpDHclUBSMcGUSpe8fsVCMnnNwRdhSX16u0AAAlESURBVHM/DXmnAZwiTTLT/N4Gfn8DHyKtH8/BtfxcTsMJJVdxcHLJHQSbbRUMrbW3Qd3ZKKgKj5rBxpWjYPNPII+HjFiXYpEh/VgOstX6HSEQsqd+9HYAOegtgjFv2netuLMAqsKDVV+wnqSBgvCqBJDO3dZzVbEqPErijaZzoIQO1v10C0D9XSG9LQVrMbYIhtbYu4L6SpFQ3Vy+M83oeenjuJpfrwQgGTO+pstMwZPMOSC/K0Q/J1rfG8xl+dYVMXoeyJ0Eo/H4Ngc2Fa94ZwVC+JWkwe6bQOlFP3D1lF4JQ4b0PcH6+dBkjdM+sqd+8Je+ACCdnCeIzA9Mg1oVHtWDjegXKIGDfT9XPYAUKECpOP1QutElcKJfa0Z0ADTbAH5OxarwKI43WlTBHpUCeXwOgK0Xw/2Vii8pPAIpbm/YlwOgpUDaLBhabX+DWhUeW0OMyXZvgCKQx9glAF8xv7mGVbB+QhbX8HMtv3VJFqsb7qC3GI93k2DMAfsa1KrwqBrcOvfrLb4I1HHS59alWPp+EP1krNZvSbJUwX0VQDp9qyByWyTyztlzM5MqPNia6m0nowNgD0ZOm1Jxw4UGxBfFGz2uQAna2/bjRMB2QLchFavCoynNSb1XOiEcANsBkE5jKmaDuoup+JLC40oiXM3/3iUAZ5iPTLU+JZVFiL4vhEuy9A3qvdm5mwRDqzpfFavCo9IpPDpUfBJAskJm9P0gZEkXIfrxvGROXYqbKPUy3QKgfkQbbyLhOi6u5+KkW9+cxB30VmN1tlEwZn/nquL0g+mGM/n3vXXsgTpuXQGTGb0WkCxZH81mPB8aQvZkklRcAiDvWuKb+yKAFGGLIDKv46lYFR6F8cYJGCgRe/N+vghAsqUjIIMe2ZOJsvFzAPL2ub4KIMXVqfgKNzO1FB5MJb0ZikAe++UA1LdkWgEkezJR5sk084mV1gcU8evVmYL1kiymYD0PDOSA/LEvOqkDqVgVHltC+s64/eHLtp9JRsgKUzDZIUNkSQNIxoynozIFZ4mMlydlqvm0It4wzAWDXLfFRalcx6WvhnBSqeeBFLC322ZB5NZI5J1tv0GtCo+Kwa1zv94+3kAdPxnRBQjZIUP6a1rJFhnjw7DIHNmT8XKvTJVP1J3qXKmqAWTVYr0c19cApCAbBUMr26+KVeHBSTTP6ECJ1xf20xZAXQEzqOnV0MZTET5R7Ml4uUGmyqmWO+Osq6J1K8ZaCfclQTiWDYLR+0dfsvK+4XwD4gvijTO5L0ARqDFY0y+ZYRvPCiDZ0svxyRzZkwUSJpOkWHg9WK+Kti5I4Ie0nQcGakCB2I+Ziree3aogVIVHY5rRQgjE/vvSPqwAkhkrgGSKAJIxskbmMiRc1DZJxgsbg3PNr1Nv2wvsywASgI2CYZXD8MEnH2D9mfUI2WwWHn0JjkCMpS2ALECsPcAFJmNGE3q8AR9/TpZ7Zbr8teX7QnjzMKsWayXMVgTngdxJIAYTyH1wTJsFj+16DF+v/rpRwQVy/31lX6YfeUJ/rgImU2zBsAIma2SuZZssCTJVmi9biDCUtp0H9kUQ+2KhFQi4yQJNt1/am/9dWoA0C5m7ZJskE1VuZhomqexat42C/GAtEnemd9xXXvvimAKhDf1GIxtkpL3+H5kiW8b8b+Il7KlfJsptMk0uqBDJZqH1OTG6H8gP16nYEavvnYBdhVXDRzbIiLX/p58H09qAviBk7XNbhoTIVFnVkoZZsbBysV4XJtl9PQp2VYSr9e8uF/108aGrX7ZfjP7fKiFr7W5TZKTMkI/Ut1m3TcOMgnou6ERBJ/rpE65t9CMjZMV6+Y0scQUM2SJjl91I5jR5td0oqCtihldGQV7rY87Xc0J9QM7r1QGnBo/666VXZENf+2XmbBv9yNZlo5+mcooMkRlyThGr54K8jKIvzekFCoyCOhJaQdQh2Xk1JuZ90Q9ab75qDnThYb3ywTqCDBnR75yQrQ5tUyVdRUF2rdk81I1pRkGdirlD7rxtJOyLDnfGdOnJpAGk9mSALFhTr158SnbIkDH3S+8Qe+pNGRIj06S4pSJmD6dtQaJTsQPhpeL0dVjbwqerXutVD7JCZlorX152i+k4gHznFBkqM+W06t1wEslwqlOxXqxqLUqcSNj3QWwPPjKg4eM0jYzoqx7s+5EhstSlbZo8JJnyF7WCQadi/Qxp5nruuC2EDoh9D0QreDrtMvJp+MgC1/yRDU7XyArbLmSHDHVrmy7PqFTMhYTsDXIHvELCHWoIrenYScl9C0ArfNSWZk27Gj4yQTbICFnhNd9X5OlusdfyxzNkbIcg1I1qDaETDXsvjFbwrFGPGut2yxfBR2Zs3dqDkCGXeZ9zQlbHTMk8uPZAtMLIwXGyrgfpvPasL9pqQa206YhnBY9aU3Nqr9OuNfLZDp8meaZKxx+2zAm5YIGTTpbdbNHwoHRa5vyAB61hZNjWkVG/6kE6r62C95QvtCYaOOql9bPO9agxtabm1J4M6DnfbPlQyIhft5nyE5ktx1sgZMXDsptzAJ4RGkQdEXnwOipaYdRAcsCO9awPqIU2DR010+DpiEdtqTG1pubUvhW+40I2ArK9IrdKphSqJiN7Pez5cALKM6ItiIyIVhg1kFYo9aCd19aoE0hfUAsNnBU6aqcjngaPGlNr3edjo5kskImAblNlgGTKszJX3lFVD88EnhFtQWS1rKOihpFAaig5b9TtHA7escD4QPudr1oPvlqho3ZtwdNRj5UutScDZKHHtllym8yW5TJXPlSdb05GNYgM05ykMipyzsABWYHk2aWNA3cscD7QftevDBJaH2pFzagdNWRQoabUlhmPWlNzah8022y5W+bIKpkn77dERIZpTlI5AA2jFUgOlGdYW9OOcF5bobDDF239zN+pgRU4K3TUjhoyuzHiUVtqTK2DdsuU4TJHxsscaZRs+VidMRyAjow8k6xQck7R1ugEx+z3QVs/83cd4agJtdGRjpox2lFDaklNqW2v2WZJvMyRe9WBz5MCmScnJUv+ogbFa8scoDbCaTWedY7Z7wOrj/nf2v98pSYELks+VlpRMyOQ3CvUsldvvAF5rtwgc+QemSOjZY5kyxzZJHOlUubJDsmSnZIlTY4F1Ac7le+pAbUwNKE29yqtWm4a9y95/x+YFT9wd0eh8QAAAABJRU5ErkJggg=="/>
</defs>
</svg>`;
  const ERROR_ICON_SVG_RAW = `<svg fill="none" height="160" viewBox="0 0 160 160" width="160" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <pattern id="a" height="1" patternContentUnits="objectBoundingBox" width="1">
    <image height="160" preserveAspectRatio="none" transform="scale(.00625)" width="160" xlink:href="data:image/png;base64,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"/>
  </pattern>
  <path d="m0 0h160v160h-160z" fill="url(#a)"/>
</svg>`;
  const DOWNLOAD_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    DOWNLOAD_ICON_SVG_RAW
  )}`;
  const SUCCESS_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    SUCCESS_ICON_SVG_RAW
  )}`;
  const ERROR_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    ERROR_ICON_SVG_RAW
  )}`;
  const STYLE_ID = "cqd-style";
  const SPINNER_SIZE_PX = 16;
  const TRANSITION_MS = 150;
  const TRANSITION_STR = `${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
  function injectStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    :root {
      --cqd-transition: ${TRANSITION_STR};

      /* Spinner */
      --cqd-spinner-border: rgba(255, 255, 255, 0.22);
      --cqd-spinner-top: #ffffff;

      /* =================================================================
       * COLOR PALETTE (Light)
       * ================================================================= */
      --cqd-color-normal: #005DD7;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 93, 215, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 93, 215, 0.70);

      --cqd-color-success: #00A82D;
      --cqd-shadow-success: 0 12px 28px rgba(0, 168, 45, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(0, 168, 45, 0.70);

      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      --cqd-color-trying: #EC6300;
      --cqd-shadow-trying: 0 12px 28px rgba(236, 99, 0, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(236, 99, 0, 0.70);

      --cqd-color-comment: #9B00FF;
      --cqd-color-edited: #007F8D;

      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);
    }

    /* =================================================================
     * DARK MODE
     * ================================================================= */
    .cqd-theme-dark {
      --cqd-color-normal: #006EFF;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 110, 255, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 110, 255, 0.70);

      --cqd-color-success: #07DA3F;
      --cqd-shadow-success: 0 12px 28px rgba(7, 218, 63, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(7, 218, 63, 0.70);

      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      --cqd-color-trying: #FF9142;
      --cqd-shadow-trying: 0 12px 28px rgba(255, 145, 66, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(255, 145, 66, 0.70);

      --cqd-color-comment: #9B00FF;
      --cqd-color-edited: #00D6EE;

      --cqd-spinner-border: rgba(15, 23, 42, 0.22);
      --cqd-spinner-top: #0f172a;
    }

    div[data-stream-item-id] {
      overflow: visible !important;
      contain: none !important;
      z-index: 1;
    }

    /* ===============================
     * 1. DOWNLOAD BUTTON (Single)
     * =============================== */
    .cqd-download-btn {
      position: absolute;
      top: 50%;
      right: 8px;
      z-index: 5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      width: 40px;
      max-width: calc(100% - 16px);
      padding: 0;
      border: none;
      border-radius: 9999px;
      background-color: var(--cqd-color-normal);
      color: #ffffff;
      box-shadow: var(--cqd-shadow-base);
      cursor: pointer;
      transform: translateY(-50%) scale(1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        width var(--cqd-transition),
        padding-inline var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition),
        transform var(--cqd-transition),
        background-color var(--cqd-transition);
    }

    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover {
      width: 120px;
      padding-inline: 12px;
      box-shadow: var(--cqd-shadow-hover);
      justify-content: flex-start;
      transform: translateY(-50%) scale(1);
      border-radius: 20px;
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }

    .cqd-download-btn:active {
      transform: translateY(-50%) scale(0.97);
    }

    .cqd-download-btn .cqd-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-icon {
      display: block;
      width: 24px;
      height: 24px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      flex-shrink: 0;
      transform-origin: center;
      transition: width var(--cqd-transition), height var(--cqd-transition);
    }

    .cqd-icon-small {
      width: 16px;
      height: 16px;
      background-size: 16px 16px;
    }

    .cqd-icon-medium {
      width: 24px;
      height: 24px;
      background-size: 24px 24px;
    }

    .cqd-icon-large {
      width: 32px;
      height: 32px;
      background-size: 32px 32px;
    }

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition: opacity var(--cqd-transition), max-width var(--cqd-transition), margin-left var(--cqd-transition);
    }

    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 4px;
    }

    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-trying,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: var(--cqd-shadow-normal);
      width: 150px;
      transform: translateY(-50%) scale(1);
    }

    .cqd-download-btn.cqd-trying {
      width: 110px;
      background-color: var(--cqd-color-trying);
      box-shadow: var(--cqd-shadow-trying);
    }

    .cqd-download-btn.cqd-loading:hover {
      box-shadow: var(--cqd-shadow-normal-strong);
    }

    .cqd-download-btn.cqd-trying:hover {
      box-shadow: var(--cqd-shadow-trying-strong);
    }

    .cqd-download-btn.cqd-loading .cqd-label,
    .cqd-download-btn.cqd-trying .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 12px;
    }

    .cqd-download-btn.cqd-success {
      width: 140px;
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-btn.cqd-success:hover {
      box-shadow: var(--cqd-shadow-success-strong);
    }

    .cqd-download-btn.cqd-success .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-error {
      width: 90px;
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
      height: 40px;
      max-width: 150px;
      max-height: 40px;
      padding-top: 0;
      padding-bottom: 0;
      align-items: center;
      transition: all var(--cqd-transition);
    }

    .cqd-error-detail {
      display: block;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.3;
      margin: 0;
      opacity: 0;
      max-height: 0;
      overflow: hidden;
      white-space: normal;
      transform: translateY(4px);
      transition: all var(--cqd-transition);
    }

    .cqd-download-btn.cqd-error:hover {
      width: 350px;
      max-width: 360px;
      height: 60px;
      max-height: 61px;
      padding: 8px;
      border-radius: 18px;
      align-items: center;
      gap: 7px;
      box-shadow: var(--cqd-shadow-error-strong);
    }

    .cqd-download-btn.cqd-error:hover .cqd-label {
      opacity: 0;
      max-width: 0;
      margin: 0;
    }

    .cqd-download-btn.cqd-error:hover .cqd-error-detail {
      opacity: 1;
      max-height: 60px;
      margin-top: 4px;
      transform: translateY(0);
    }

    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${SPINNER_SIZE_PX}px;
      height: ${SPINNER_SIZE_PX}px;
      border: 3px solid var(--cqd-spinner-border);
      border-top-color: var(--cqd-spinner-top);
      animation: cqd-spin 0.65s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* ===============================
     * 2. COMMENTS & EDITED (Overlay)
     * =============================== */
    .cqd-overlay-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
      box-sizing: border-box;
      border-radius: inherit;
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-comment),
        0 0 12px rgba(99, 102, 241, 0.5);
    }

    .cqd-comment-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 30px;
      background-color: var(--cqd-color-comment);
      color: #ffffff;
      border-radius: 9999px;
      cursor: pointer;
      overflow: hidden;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
    }

    .cqd-comment-badge:hover {
      height: 50px;
      border-radius: 20px;
      padding-bottom: 8px;
      z-index: 10000;
    }

    body[data-cqd-dir="ltr"] .cqd-comment-badge {
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-comment-badge {
      right: 0;
      transform: translateX(50%);
    }

    .cqd-badge-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      filter: brightness(0) invert(1);
      margin-top: 4px;
    }

    .cqd-badge-label {
      display: block;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 700;
      opacity: 0;
      transform: translateY(-5px);
      max-height: 0;
      margin-top: 2px;
      overflow: hidden;
      transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
    }

    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }

    .cqd-overlay-container.cqd-edited {
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-edited),
        0 0 12px rgba(0, 214, 238, 0.3);
    }

    .cqd-edited-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 30px;
      background-color: var(--cqd-color-edited);
      color: #ffffff;
      border-radius: 9999px;
      cursor: default;
      overflow: hidden;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-edited-badge {
      right: 0;
      transform: translateX(50%);
    }

    body[data-cqd-dir="ltr"] .cqd-edited-badge {
      left: 0;
      transform: translateX(-50%);
    }

    .cqd-edited-icon {
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cqd-edited-icon svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .cqd-edited-badge:hover {
      height: 50px;
      border-radius: 20px;
      padding-bottom: 8px;
      z-index: 10000;
    }

    .cqd-edited-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 13px;
    }

    .cqd-edited-badge:hover .cqd-edited-content {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }

    .cqd-diff-val {
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 13px;
    }

    div[data-stream-item-id][data-cqd-processed][data-cqd-edited-processed] > .cqd-overlay-container {
      box-shadow:
        inset 0 0 0 2px #FF4036,
        0 0 12px rgba(255, 64, 54, 0.70);
    }

    .cqd-both-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 70px;
      background-color: #FF4036;
      color: #ffffff;
      border-radius: 9999px;
      border: 1px solid rgba(255, 64, 54, 0.70);
      cursor: pointer;
      overflow: hidden;
      padding-top: 8px;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
    }

    body[data-cqd-dir="ltr"] .cqd-both-badge {
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-both-badge {
      right: 0;
      transform: translateX(50%);
    }

    .cqd-both-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .cqd-both-icon {
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    }

    .cqd-both-icon-edited svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .cqd-both-plus {
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      margin: 5px;
    }

    .cqd-both-value,
    .cqd-both-divider {
      opacity: 0;
      max-height: 0;
      margin-top: 0;
      overflow: hidden;
      transition:
        opacity 0.15s ease 0.05s,
        max-height 0.15s ease 0.05s,
        margin-top 0.15s ease 0.05s;
    }

    .cqd-both-value {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }

    .cqd-both-badge:hover {
      height: 120px;
      border-radius: 20px;
    }

    .cqd-both-badge:hover .cqd-both-value {
      opacity: 1;
      max-height: 20px;
      margin-top: 2px;
    }

    .cqd-both-badge:hover .cqd-both-divider {
      opacity: 1;
      max-height: 4px;
      margin-top: 2px;
    }

    /* ===============================
     * 1b. DOWNLOAD ALL BUTTON (Redesigned & Repositioned)
     * =============================== */

    .cqd-download-all-btn {
      /* Progress control (0% to 100%) */
      --cqd-progress: 0%;

      position: absolute;
      /* Positioning in Header area (approx left of 3-dots) */
      top: -80px;
      right: 48px;
      z-index: 6;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 12px;
      border: none;
      border-radius: 9999px;

      /* Solid Colors (No Blur) */
      background-color: var(--cqd-color-normal);
      color: #ffffff;
      box-shadow: var(--cqd-shadow-normal);

      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      gap: 6px;
      white-space: nowrap;
      overflow: hidden;

      height: 40px; /* Match single-download button height */

      transition:
        box-shadow 0.2s ease,
        transform 0.1s ease,
        background-color 0.3s ease;

      transform: translateZ(0);
    }

    body[data-cqd-dir="rtl"] .cqd-download-all-btn {
      right: auto;
      left: 48px;
    }

    .cqd-download-all-btn:not(:disabled):hover {
      box-shadow: var(--cqd-shadow-hover);
      transform: translateY(-1px);
    }

    .cqd-download-all-btn:not(:disabled):active {
      transform: translateY(0);
    }

    .cqd-download-all-btn:disabled {
      cursor: default;
      opacity: 0.7;
      box-shadow: none;
      transform: none;
    }

    /* FULL SUCCESS STATE (Solid Green) */
    .cqd-download-all-btn.cqd-all-success {
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-all-btn.cqd-all-error {
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
    }

    /* PROGRESS BAR OVERLAY (Fills up) */
    .cqd-download-all-btn::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 0;

      background-color: var(--cqd-color-success);

      /* Width controlled by JS */
      width: var(--cqd-progress);
      transition: width 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);

      opacity: 1;
    }

    /* When fully successful, the main bg becomes green anyway, so we can hide progress */
    .cqd-download-all-btn.cqd-all-success::after {
      opacity: 0;
    }

    /* Content layers */
    .cqd-download-all-btn .cqd-download-all-main,
    .cqd-download-all-btn .cqd-download-all-sub,
    .cqd-download-all-btn .cqd-download-all-icon-wrapper {
      position: relative;
      z-index: 2;
    }

    .cqd-download-all-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-all-icon {
      width: 18px;
      height: 18px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 18px 18px;
      flex-shrink: 0;
    }

    .cqd-download-all-main {
      font-weight: 600;
    }

    .cqd-download-all-sub {
      font-size: 11px;
      opacity: 0.9;
      margin-left: 4px;
    }

  `.trim();
    (document.head || document.documentElement).appendChild(style);
  }
  const TRANSLATIONS = {
    en: {
      download: "Download",
      downloading: "Downloading…",
      trying: "Trying…",
      downloaded: "Downloaded",
      error: "Error",
      failed: "Download failed.",
      ariaDownload: "Download",
      titleQuick: "Quick download",
      comments: "comments",
      edited: "Edited",
      downloadAll: "Download all"
    },
    ar: {
      download: "تنزيل",
      downloading: "جاري التنزيل…",
      trying: "محاولة…",
      downloaded: "تم التنزيل",
      error: "خطأ",
      failed: "فشل التنزيل.",
      ariaDownload: "تنزيل",
      titleQuick: "تنزيل سريع",
      comments: "تعليقات",
      edited: "تم التعديل",
      downloadAll: "تنزيل الكل"
    },
    ja: {
      download: "ダウンロード",
      downloading: "DL中…",
      trying: "試行中…",
      downloaded: "完了",
      error: "エラー",
      failed: "失敗しました。",
      ariaDownload: "ダウンロード",
      titleQuick: "クイックダウンロード",
      comments: "件のコメント",
      edited: "編集済み"
    },
    es: {
      download: "Descargar",
      downloading: "Descargando…",
      trying: "Intentando…",
      downloaded: "Descargado",
      error: "Error",
      failed: "Falló la descarga.",
      ariaDownload: "Descargar",
      titleQuick: "Descarga rápida",
      comments: "comentarios",
      edited: "Editado"
    },
    hi: {
      download: "डाउनलोड",
      downloading: "डाउनलोडिंग…",
      trying: "कोशिश जारी…",
      downloaded: "पूर्ण",
      error: "त्रुटि",
      failed: "विफल रहा",
      ariaDownload: "डाउनलोड",
      titleQuick: "त्वरित डाउनलोड",
      comments: "टिप्पणियाँ",
      edited: "संपादित"
    },
    pt: {
      download: "Baixar",
      downloading: "Baixando…",
      trying: "Tentando…",
      downloaded: "Baixado",
      error: "Erro",
      failed: "Falha ao baixar.",
      ariaDownload: "Baixar",
      titleQuick: "Download rápido",
      comments: "comentários",
      edited: "Editado"
    },
    "pt-pt": {
      download: "Descarregar",
      downloading: "A descarregar…",
      trying: "A tentar…",
      downloaded: "Descarregado",
      error: "Erro",
      failed: "Falha ao descarregar.",
      ariaDownload: "Descarregar",
      titleQuick: "Descarga rápida",
      comments: "comentários",
      edited: "Editado"
    },
    "zh-cn": {
      download: "下载",
      downloading: "下载中…",
      trying: "尝试中…",
      downloaded: "已下载",
      error: "错误",
      failed: "下载失败",
      ariaDownload: "下载",
      titleQuick: "快速下载",
      comments: "条评论",
      edited: "已编辑"
    },
    "zh-tw": {
      download: "下載",
      downloading: "下載中…",
      trying: "嘗試中…",
      downloaded: "已下載",
      error: "錯誤",
      failed: "下載失敗",
      ariaDownload: "下載",
      titleQuick: "快速下載",
      comments: "則留言",
      edited: "已編輯"
    },
    fr: {
      download: "Télécharger",
      downloading: "Téléchargement…",
      trying: "Essai…",
      downloaded: "Téléchargé",
      error: "Erreur",
      failed: "Échec.",
      ariaDownload: "Télécharger",
      titleQuick: "Téléchargement rapide",
      comments: "commentaires",
      edited: "Modifié"
    },
    de: {
      download: "Herunterladen",
      downloading: "Laden…",
      trying: "Versuchen…",
      downloaded: "Fertig",
      error: "Fehler",
      failed: "Fehlgeschlagen.",
      ariaDownload: "Herunterladen",
      titleQuick: "Schneller Download",
      comments: "Kommentare",
      edited: "Bearbeitet"
    },
    it: {
      download: "Scarica",
      downloading: "Scaricamento…",
      trying: "Provando…",
      downloaded: "Scaricato",
      error: "Errore",
      failed: "Fallito.",
      ariaDownload: "Scarica",
      titleQuick: "Download rapido",
      comments: "commenti",
      edited: "Modificato"
    },
    ru: {
      download: "Скачать",
      downloading: "Скачивание…",
      trying: "Попытка…",
      downloaded: "Скачано",
      error: "Ошибка",
      failed: "Сбой.",
      ariaDownload: "Скачать",
      titleQuick: "Быстрое скачивание",
      comments: "комментариев",
      edited: "Изменено"
    },
    ko: {
      download: "다운로드",
      downloading: "다운로드 중…",
      trying: "시도 중…",
      downloaded: "완료",
      error: "오류",
      failed: "실패함",
      ariaDownload: "다운로드",
      titleQuick: "빠른 다운로드",
      comments: "개 댓글",
      edited: "수정됨"
    },
    tr: {
      download: "İndir",
      downloading: "İndiriliyor…",
      trying: "Deneniyor…",
      downloaded: "İndirildi",
      error: "Hata",
      failed: "Başarısız.",
      ariaDownload: "İndir",
      titleQuick: "Hızlı indir",
      comments: "yorum",
      edited: "Düzenlendi"
    },
    vi: {
      download: "Tải xuống",
      downloading: "Đang tải…",
      trying: "Đang thử…",
      downloaded: "Đã tải",
      error: "Lỗi",
      failed: "Thất bại.",
      ariaDownload: "Tải xuống",
      titleQuick: "Tải xuống nhanh",
      comments: "nhận xét",
      edited: "Đã chỉnh sửa"
    },
    id: {
      download: "Download",
      downloading: "Mengunduh…",
      trying: "Mencoba…",
      downloaded: "Selesai",
      error: "Kesalahan",
      failed: "Gagal.",
      ariaDownload: "Download",
      titleQuick: "Download cepat",
      comments: "komentar",
      edited: "Diedit"
    },
    th: {
      download: "ดาวน์โหลด",
      downloading: "กำลังโหลด…",
      trying: "พยายาม…",
      downloaded: "เสร็จสิ้น",
      error: "ข้อผิดพลาด",
      failed: "ล้มเหลว",
      ariaDownload: "ดาวน์โหลด",
      titleQuick: "ดาวน์โหลดด่วน",
      comments: "ความคิดเห็น",
      edited: "แก้ไขแล้ว"
    },
    pl: {
      download: "Pobierz",
      downloading: "Pobieranie…",
      trying: "Próba…",
      downloaded: "Pobrano",
      error: "Błąd",
      failed: "Nieudane.",
      ariaDownload: "Pobierz",
      titleQuick: "Szybkie pobieranie",
      comments: "komentarze",
      edited: "Edytowano"
    },
    nl: {
      download: "Downloaden",
      downloading: "Downloaden…",
      trying: "Proberen…",
      downloaded: "Klaar",
      error: "Fout",
      failed: "Mislukt.",
      ariaDownload: "Downloaden",
      titleQuick: "Snel downloaden",
      comments: "reacties",
      edited: "Bewerkt"
    },
    bn: {
      download: "ডাউনলোড",
      downloading: "ডাউনলোড হচ্ছে…",
      trying: "চেষ্টা করছে…",
      downloaded: "সম্পন্ন",
      error: "ত্রুটি",
      failed: "ব্যর্থ হয়েছে",
      ariaDownload: "ডাউনলোড",
      titleQuick: "দ্রুত ডাউনলোড",
      comments: "টি মন্তব্য",
      edited: "সম্পাদিত"
    },
    pa: {
      download: "ਡਾਉਨਲੋਡ",
      downloading: "ਡਾਉਨਲੋਡ ਹੋ ਰਿਹਾ…",
      trying: "ਕੋਸ਼ਿਸ਼ ਜਾਰੀ…",
      downloaded: "ਮੁਕੰਮਲ",
      error: "ਗਲਤੀ",
      failed: "ਅਸਫਲ",
      ariaDownload: "ਡਾਉਨਲੋਡ",
      titleQuick: "ਤੇਜ਼ ਡਾਉਨਲੋਡ",
      comments: "ਟਿੱਪਣੀਆਂ",
      edited: "ਸੰਪਾਦਿਤ"
    },
    te: {
      download: "డౌన్‌లోడ్",
      downloading: "డౌన్‌లోడ్ అవుతోంది…",
      trying: "ప్రయత్నిస్తోంది…",
      downloaded: "పూర్తయింది",
      error: "లోపం",
      failed: "విఫలమైంది",
      ariaDownload: "డౌన్‌లోడ్",
      titleQuick: "త్వరిత డౌన్‌లోడ్",
      comments: "వ్యాఖ్యలు",
      edited: "సవరించబడింది"
    },
    mr: {
      download: "डाउनलोड",
      downloading: "डाउनलोड होत आहे…",
      trying: "प्रयत्न करत आहे…",
      downloaded: "पूर्ण",
      error: "त्रुटी",
      failed: "अयशस्वी",
      ariaDownload: "डाउनलोड",
      titleQuick: "त्वरित डाउनलोड",
      comments: "टिप्पण्या",
      edited: "संपादित"
    },
    ta: {
      download: "பதிவிறக்கு",
      downloading: "பதிவிறக்கப்படுகிறது…",
      trying: "முயற்சிக்கிறது…",
      downloaded: "முடிந்தது",
      error: "பிழை",
      failed: "தோல்வி",
      ariaDownload: "பதிவிறக்கு",
      titleQuick: "விரைவு பதிவிறக்கம்",
      comments: "கருத்துகள்",
      edited: "திருத்தப்பட்டது"
    },
    ur: {
      download: "ڈاؤن لوڈ",
      downloading: "ڈاؤن لوڈ ہو رہا ہے…",
      trying: "کوشش جاری…",
      downloaded: "مکمل",
      error: "غلطی",
      failed: "ناکام",
      ariaDownload: "ڈاؤن لوڈ",
      titleQuick: "فوری ڈاؤن لوڈ",
      comments: "تبصرے",
      edited: "ترمیم شدہ"
    },
    gu: {
      download: "ડાઉનલોડ",
      downloading: "ડાઉનલોડ થઈ રહ્યું છે…",
      trying: "પ્રયાસ ચાલુ…",
      downloaded: "પૂર્ણ",
      error: "ભૂલ",
      failed: "નિષ્ફળ",
      ariaDownload: "ડાઉનલોડ",
      titleQuick: "ઝડપી ડાઉનલોડ",
      comments: "ટિપ્પણીઓ",
      edited: "સંપાદિત"
    },
    kn: {
      download: "ಡೌನ್‌ಲೋಡ್",
      downloading: "ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
      trying: "ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ…",
      downloaded: "ಪೂರ್ಣಗೊಂಡಿದೆ",
      error: "ದೋಷ",
      failed: "ವಿಫಲವಾಗಿದೆ",
      ariaDownload: "ಡೌನ್‌ಲೋಡ್",
      titleQuick: "ತ್ವರಿತ ಡೌನ್‌ಲೋಡ್",
      comments: "ಕಾಮೆಂಟ್‌ಗಳು",
      edited: "ಸಂಪಾದಿಸಲಾಗಿದೆ"
    },
    ml: {
      download: "ഡൗൺലോഡ്",
      downloading: "ഡൗൺലോഡ് ചെയ്യുന്നു…",
      trying: "ശ്രമിക്കുന്നു…",
      downloaded: "പൂർത്തിയായി",
      error: "പിശക്",
      failed: "പരാജയപ്പെട്ടു",
      ariaDownload: "ഡൗൺലോഡ്",
      titleQuick: "വേഗത്തിൽ ഡൗൺലോഡ്",
      comments: "അഭിപ്രായങ്ങൾ",
      edited: "എഡിറ്റുചെയ്തു"
    },
    uk: {
      download: "Завантажити",
      downloading: "Завантаження…",
      trying: "Спроба…",
      downloaded: "Готово",
      error: "Помилка",
      failed: "Невдача.",
      ariaDownload: "Завантажити",
      titleQuick: "Швидке завантаження",
      comments: "коментарів",
      edited: "Змінено"
    },
    el: {
      download: "Λήψη",
      downloading: "Λήψη…",
      trying: "Προσπάθεια…",
      downloaded: "Ολοκληρώθηκε",
      error: "Σφάλμα",
      failed: "Απέτυχε.",
      ariaDownload: "Λήψη",
      titleQuick: "Γρήγορη λήψη",
      comments: "σχόλια",
      edited: "Επεξεργασμένο"
    },
    cs: {
      download: "Stáhnout",
      downloading: "Stahování…",
      trying: "Zkouším…",
      downloaded: "Staženo",
      error: "Chyba",
      failed: "Selhalo.",
      ariaDownload: "Stáhnout",
      titleQuick: "Rychlé stažení",
      comments: "komentářů",
      edited: "Upraveno"
    },
    ro: {
      download: "Descărcați",
      downloading: "Se descarcă…",
      trying: "Se încearcă…",
      downloaded: "Finalizat",
      error: "Eroare",
      failed: "Eșuat.",
      ariaDownload: "Descărcați",
      titleQuick: "Descărcare rapidă",
      comments: "comentarii",
      edited: "Modificat"
    },
    hu: {
      download: "Letöltés",
      downloading: "Letöltés…",
      trying: "Próbálkozás…",
      downloaded: "Kész",
      error: "Hiba",
      failed: "Sikertelen.",
      ariaDownload: "Letöltés",
      titleQuick: "Gyors letöltés",
      comments: "megjegyzés",
      edited: "Szerkesztve"
    },
    sv: {
      download: "Ladda ner",
      downloading: "Laddar ner…",
      trying: "Försöker…",
      downloaded: "Klart",
      error: "Fel",
      failed: "Misslyckades.",
      ariaDownload: "Ladda ner",
      titleQuick: "Snabb nedladdning",
      comments: "kommentarer",
      edited: "Redigerad"
    },
    da: {
      download: "Hent",
      downloading: "Henter…",
      trying: "Prøver…",
      downloaded: "Hentet",
      error: "Fejl",
      failed: "Mislykkedes.",
      ariaDownload: "Hent",
      titleQuick: "Hurtig download",
      comments: "kommentarer",
      edited: "Redigeret"
    },
    fi: {
      download: "Lataa",
      downloading: "Ladataan…",
      trying: "Yritetään…",
      downloaded: "Ladattu",
      error: "Virhe",
      failed: "Epäonnistui.",
      ariaDownload: "Lataa",
      titleQuick: "Pikalataus",
      comments: "kommenttia",
      edited: "Muokattu"
    },
    no: {
      download: "Last ned",
      downloading: "Laster ned…",
      trying: "Prøver…",
      downloaded: "Ferdig",
      error: "Feil",
      failed: "Mislyktes.",
      ariaDownload: "Last ned",
      titleQuick: "Rask nedlasting",
      comments: "kommentarer",
      edited: "Redigert"
    },
    he: {
      download: "הורדה",
      downloading: "מוריד…",
      trying: "מנסה…",
      downloaded: "הושלם",
      error: "שגיאה",
      failed: "נכשל",
      ariaDownload: "הורדה",
      titleQuick: "הורדה מהירה",
      comments: "תגובות",
      edited: "נערך"
    },
    fa: {
      download: "دانلود",
      downloading: "درحال دانلود…",
      trying: "تلاش مجدد…",
      downloaded: "انجام شد",
      error: "خطا",
      failed: "ناموفق",
      ariaDownload: "دانلود",
      titleQuick: "دانلود سریع",
      comments: "نظر",
      edited: "ویرایش شده"
    },
    fil: {
      download: "I-download",
      downloading: "Nagda-download…",
      trying: "Sinusubukan…",
      downloaded: "Tapos na",
      error: "Error",
      failed: "Nabigo.",
      ariaDownload: "I-download",
      titleQuick: "Mabilis na download",
      comments: "mga komento",
      edited: "Na-edit"
    },
    ms: {
      download: "Muat turun",
      downloading: "Memuat turun…",
      trying: "Mencuba…",
      downloaded: "Selesai",
      error: "Ralat",
      failed: "Gagal.",
      ariaDownload: "Muat turun",
      titleQuick: "Muat turun pantas",
      comments: "komen",
      edited: "Diedit"
    },
    sr: {
      download: "Преузми",
      downloading: "Преузимање…",
      trying: "Покушавам…",
      downloaded: "Завршено",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Преузми",
      titleQuick: "Брзо преузимање",
      comments: "коментара",
      edited: "Измењено"
    },
    sk: {
      download: "Stiahnuť",
      downloading: "Sťahovanie…",
      trying: "Skúšam…",
      downloaded: "Hotovo",
      error: "Chyba",
      failed: "Zlyhalo.",
      ariaDownload: "Stiahnuť",
      titleQuick: "Rýchle stiahnutie",
      comments: "komentárov",
      edited: "Upravené"
    },
    bg: {
      download: "Изтегли",
      downloading: "Изтегляне…",
      trying: "Опит…",
      downloaded: "Готово",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Изтегли",
      titleQuick: "Бързо изтегляне",
      comments: "коментара",
      edited: "Редактирано"
    },
    hr: {
      download: "Preuzmi",
      downloading: "Preuzimanje…",
      trying: "Pokušavam…",
      downloaded: "Gotovo",
      error: "Greška",
      failed: "Neuspjelo.",
      ariaDownload: "Preuzmi",
      titleQuick: "Brzo preuzimanje",
      comments: "komentara",
      edited: "Uređeno"
    },
    lt: {
      download: "Atsisiųsti",
      downloading: "Siunčiama…",
      trying: "Bandoma…",
      downloaded: "Baigta",
      error: "Klaida",
      failed: "Nepavyko.",
      ariaDownload: "Atsisiųsti",
      titleQuick: "Greitas atsisiuntimas",
      comments: "komentarai",
      edited: "Redaguota"
    },
    lv: {
      download: "Lejupielādēt",
      downloading: "Lejupielādē…",
      trying: "Mēģina…",
      downloaded: "Pabeigts",
      error: "Kļūda",
      failed: "Neizdevās.",
      ariaDownload: "Lejupielādēt",
      titleQuick: "Ātrā lejupielāde",
      comments: "komentāri",
      edited: "Rediģēts"
    },
    et: {
      download: "Laadi alla",
      downloading: "Laadimine…",
      trying: "Proovin…",
      downloaded: "Valmis",
      error: "Viga",
      failed: "Ebaõnnestus.",
      ariaDownload: "Laadi alla",
      titleQuick: "Kiire allalaadimine",
      comments: "kommentaari",
      edited: "Muudetud"
    },
    sl: {
      download: "Prenos",
      downloading: "Prenašanje…",
      trying: "Poskušam…",
      downloaded: "Končano",
      error: "Napaka",
      failed: "Ni uspelo.",
      ariaDownload: "Prenos",
      titleQuick: "Hiter prenos",
      comments: "komentarjev",
      edited: "Urejeno"
    },
    ca: {
      download: "Descarrega",
      downloading: "Descarregant…",
      trying: "Intentant…",
      downloaded: "Descarregat",
      error: "Error",
      failed: "Ha fallat.",
      ariaDownload: "Descarrega",
      titleQuick: "Descàrrega ràpida",
      comments: "comentaris",
      edited: "Editat"
    },
    af: {
      download: "Aflaai",
      downloading: "Laai af…",
      trying: "Probeer…",
      downloaded: "Klaar",
      error: "Fout",
      failed: "Misluk.",
      ariaDownload: "Aflaai",
      titleQuick: "Vinnige aflaai",
      comments: "kommentare",
      edited: "Geredigeer"
    },
    am: {
      download: "አውርድ",
      downloading: "በማውረድ ላይ…",
      trying: "በመሞከር ላይ…",
      downloaded: "ወርዷል",
      error: "ስህተት",
      failed: "አልተሳካም።",
      ariaDownload: "አውርድ",
      titleQuick: "ፈጣን ማውረድ",
      comments: "አስተያየቶች",
      edited: "ተስተካክሏል"
    },
    hy: {
      download: "Ներբեռնել",
      downloading: "Ներբեռնում…",
      trying: "Փորձում է…",
      downloaded: "Ավարտված",
      error: "Սխալ",
      failed: "Ձախողվեց:",
      ariaDownload: "Ներբեռնել",
      titleQuick: "Արագ ներբեռնում",
      comments: "մեկնաբանություն",
      edited: "Խմբագրվել է"
    },
    as: {
      download: "ডাউন্লোড",
      downloading: "ডাউন্লোড হৈ আছে…",
      trying: "চেষ্টা কৰি আছে…",
      downloaded: "সম্পূৰ্ণ",
      error: "ত্ৰুটি",
      failed: "বিফল হ’ল",
      ariaDownload: "ডাউন্লোড",
      titleQuick: "দ্ৰুত ডাউন্লোড",
      comments: "মন্তব্য",
      edited: "সম্পাদিত"
    },
    az: {
      download: "Yüklə",
      downloading: "Yüklənir…",
      trying: "Cəhd edilir…",
      downloaded: "Bitdi",
      error: "Xəta",
      failed: "Alınmadı.",
      ariaDownload: "Yüklə",
      titleQuick: "Sürətli yükləmə",
      comments: "şərh",
      edited: "Düzəliş edilib"
    },
    eu: {
      download: "Deskargatu",
      downloading: "Deskargatzen…",
      trying: "Saiatzen…",
      downloaded: "Eginda",
      error: "Errorea",
      failed: "Huts egin du.",
      ariaDownload: "Deskargatu",
      titleQuick: "Deskarga azkarra",
      comments: "iruzkin",
      edited: "Editatua"
    },
    my: {
      download: "ဒေါင်းလုဒ်",
      downloading: "ဒေါင်းလုဒ် လုပ်နေ…",
      trying: "ကြိုးစားနေ…",
      downloaded: "ပြီးပါပြီ",
      error: "အမှား",
      failed: "မအောင်မြင်ပါ။",
      ariaDownload: "ဒေါင်းလုဒ်",
      titleQuick: "အမြန် ဒေါင်းလုဒ်",
      comments: "မှတ်ချက်များ",
      edited: "ပြင်ဆင်ပြီး"
    },
    gl: {
      download: "Descargar",
      downloading: "Descargando…",
      trying: "Tentando…",
      downloaded: "Descargado",
      error: "Erro",
      failed: "Fallou.",
      ariaDownload: "Descargar",
      titleQuick: "Descarga rápida",
      comments: "comentarios",
      edited: "Editado"
    },
    ka: {
      download: "ჩამოტვირთვა",
      downloading: "იწერება…",
      trying: "მცდელობა…",
      downloaded: "დასრულდა",
      error: "შეცდომა",
      failed: "ვერ მოხერხდა.",
      ariaDownload: "ჩამოტვირთვა",
      titleQuick: "სწრაფი ჩამოტვირთვა",
      comments: "კომენტარი",
      edited: "რედაქტირებულია"
    },
    is: {
      download: "Sækja",
      downloading: "Sækir…",
      trying: "Reyni…",
      downloaded: "Sótt",
      error: "Villa",
      failed: "Mistókst.",
      ariaDownload: "Sækja",
      titleQuick: "Flýtiniðurhal",
      comments: "ummæli",
      edited: "Breytt"
    },
    ga: {
      download: "Íoslódáil",
      downloading: "Ag íoslódáil…",
      trying: "Ag iarraidh…",
      downloaded: "Íoslódáilte",
      error: "Earráid",
      failed: "Theip air.",
      ariaDownload: "Íoslódáil",
      titleQuick: "Íoslódáil tapa",
      comments: "trácht",
      edited: "Eagraithe"
    },
    kk: {
      download: "Жүктеп алу",
      downloading: "Жүктелуде…",
      trying: "Әрекет…",
      downloaded: "Аяқталды",
      error: "Қате",
      failed: "Сәтсіз.",
      ariaDownload: "Жүктеп алу",
      titleQuick: "Жылдам жүктеу",
      comments: "пікір",
      edited: "Өзгертілді"
    },
    km: {
      download: "ទាញយក",
      downloading: "កំពុងទាញយក…",
      trying: "កំពុងព្យាយាម…",
      downloaded: "បានបញ្ចប់",
      error: "កំហុស",
      failed: "បរាជ័យ",
      ariaDownload: "ទាញយក",
      titleQuick: "ទាញយកលឿន",
      comments: "មតិ",
      edited: "បានកែសម្រួល"
    },
    lo: {
      download: "ດາວໂຫລດ",
      downloading: "ກຳລັງດາວໂຫລດ…",
      trying: "ກຳລັງພະຍາຍາມ…",
      downloaded: "ສຳເລັດ",
      error: "ຜິດພາດ",
      failed: "ລົ້ມເຫລວ",
      ariaDownload: "ດາວໂຫລດ",
      titleQuick: "ດາວໂຫລດດ່ວນ",
      comments: "ຄຳເຫັນ",
      edited: "ແກ້ໄຂແລ້ວ"
    },
    mk: {
      download: "Преземи",
      downloading: "Преземање…",
      trying: "Се обидувам…",
      downloaded: "Готово",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Преземи",
      titleQuick: "Брзо преземање",
      comments: "коментари",
      edited: "Изменето"
    },
    mn: {
      download: "Татах",
      downloading: "Татаж байна…",
      trying: "Орлдож байна…",
      downloaded: "Татсан",
      error: "Алдаа",
      failed: "Амжилтгүй.",
      ariaDownload: "Татах",
      titleQuick: "Хурдан татах",
      comments: "сэтгэгдэл",
      edited: "Зассан"
    },
    ne: {
      download: "डाउनलोड",
      downloading: "डाउनलोड हुँदै…",
      trying: "प्रयास गर्दै…",
      downloaded: "पूरा भयो",
      error: "त्रुटि",
      failed: "असफल भयो",
      ariaDownload: "डाउनलोड",
      titleQuick: "छिटो डाउनलोड",
      comments: "टिप्पणीहरू",
      edited: "सम्पादित"
    },
    or: {
      download: "ଡାଉନଲୋଡ୍",
      downloading: "ଡାଉନଲୋଡ୍ ହେଉଛି…",
      trying: "ଚେଷ୍ଟା କରୁଛି…",
      downloaded: "ସମ୍ପୂର୍ଣ୍ଣ",
      error: "ତ୍ରୁଟି",
      failed: "ବିଫଳ ହେଲା",
      ariaDownload: "ଡାଉନଲୋଡ୍",
      titleQuick: "ଶୀଘ୍ର ଡାଉନଲୋଡ୍",
      comments: "ମନ୍ତବ୍ୟ",
      edited: "ସମ୍ପାଦିତ"
    },
    si: {
      download: "බාගන්න",
      downloading: "බාගත වෙමින්…",
      trying: "උත්සාහ කරමින්…",
      downloaded: "අවසන්",
      error: "දෝෂයකි",
      failed: "අසාර්ථකයි",
      ariaDownload: "බාගන්න",
      titleQuick: "ඉක්මන් බාගත කිරීම",
      comments: "අදහස්",
      edited: "සංස්කරණය"
    },
    sw: {
      download: "Pakua",
      downloading: "Inapakua…",
      trying: "Inajaribu…",
      downloaded: "Imekamilika",
      error: "Hitilafu",
      failed: "Imeshindwa.",
      ariaDownload: "Pakua",
      titleQuick: "Pakua haraka",
      comments: "maoni",
      edited: "Imehaririwa"
    },
    uz: {
      download: "Yuklash",
      downloading: "Yuklanmoqda…",
      trying: "Urinilmoqda…",
      downloaded: "Tayyor",
      error: "Xato",
      failed: "Muvaffaqiyatsiz.",
      ariaDownload: "Yuklash",
      titleQuick: "Tez yuklash",
      comments: "sharhlar",
      edited: "Tahrirlangan"
    },
    cy: {
      download: "Lawrlwytho",
      downloading: "Yn lawrlwytho…",
      trying: "Yn ceisio…",
      downloaded: "Wedi gorffen",
      error: "Gwall",
      failed: "Methodd.",
      ariaDownload: "Lawrlwytho",
      titleQuick: "Lawrlwytho cyflym",
      comments: "sylwadau",
      edited: "Golygwyd"
    },
    zu: {
      download: "Landa",
      downloading: "Iyalandwa…",
      trying: "Iyazama…",
      downloaded: "Ilandīwe",
      error: "Iphutha",
      failed: "Ihlulekile.",
      ariaDownload: "Landa",
      titleQuick: "Ukulanda okusheshayo",
      comments: "amazwana",
      edited: "Kuhleliwe"
    },
    sq: {
      download: "Shkarko",
      downloading: "Duke shkarkuar…",
      trying: "Duke provuar…",
      downloaded: "Përfundoi",
      error: "Gabim",
      failed: "Dështoi.",
      ariaDownload: "Shkarko",
      titleQuick: "Shkarkim i shpejtë",
      comments: "komente",
      edited: "E redaktuar"
    }
  };
  function t(key) {
    try {
      if (!key || typeof key !== "string") {
        return "...";
      }
      let rawLang = "en";
      if (typeof document !== "undefined" && document.documentElement && document.documentElement.lang) {
        rawLang = document.documentElement.lang;
      } else if (typeof navigator !== "undefined" && navigator.language) {
        rawLang = navigator.language;
      }
      const normalizedLang = rawLang.toLowerCase().split(";")[0].trim().replace("_", "-");
      const baseLang = normalizedLang.split("-")[0];
      if (TRANSLATIONS[normalizedLang] && typeof TRANSLATIONS[normalizedLang][key] === "string") {
        return TRANSLATIONS[normalizedLang][key];
      }
      if (TRANSLATIONS[baseLang] && typeof TRANSLATIONS[baseLang][key] === "string") {
        return TRANSLATIONS[baseLang][key];
      }
      if (TRANSLATIONS["en"] && typeof TRANSLATIONS["en"][key] === "string") {
        return TRANSLATIONS["en"][key];
      }
      return key;
    } catch {
      try {
        return TRANSLATIONS["en"][key] || key;
      } catch {
        return String(key || "Download");
      }
    }
  }
  function isPageDark() {
    if (typeof document === "undefined") return false;
    const drScheme = document.documentElement.getAttribute("data-darkreader-scheme");
    if (drScheme === "dark") return true;
    if (drScheme === "light") return false;
    const darkTokens = ["dark", "dark-theme", "theme-dark", "night", "gm3-dark-theme"];
    const htmlClass = (document.documentElement.className || "").toLowerCase();
    const bodyClass = (document.body.className || "").toLowerCase();
    if (darkTokens.some((token) => htmlClass.includes(token) || bodyClass.includes(token))) {
      return true;
    }
    const probeEl = document.querySelector("div[data-stream-item-id]") || document.querySelector('[role="main"]') || document.body;
    const bgColor = getEffectiveBackgroundColor(probeEl);
    const brightness = parseBrightness(bgColor);
    return brightness < 105;
  }
  function getEffectiveBackgroundColor(start) {
    let el = start;
    const isTransparent = (c) => !c || c === "transparent" || c === "rgba(0, 0, 0, 0)";
    while (el) {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      if (!isTransparent(bg)) return bg;
      el = el.parentElement;
    }
    const htmlStyle = window.getComputedStyle(document.documentElement);
    const htmlBg = htmlStyle.backgroundColor;
    if (!isTransparent(htmlBg)) return htmlBg;
    return "rgb(255, 255, 255)";
  }
  function parseBrightness(rgbString) {
    const match = rgbString.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) {
      return 255;
    }
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const brightness = Math.sqrt(
      0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)
    );
    return brightness;
  }
  const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;
  const INJECTED_ATTR = "data-cqd-injected";
  const PROCESSED_ATTR = "data-cqd-processed";
  const RESCAN_INTERVAL_MS = 2e3;
  const RESCAN_DEBOUNCE_MS = 200;
  const LOADING_MIN_MS = 600;
  const FEEDBACK_SUCCESS_MS = 3e3;
  const FEEDBACK_ERROR_MS = 4e3;
  const DRIVE_ANCHOR_SELECTOR = 'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';
  const ATTACHMENT_CONTAINER_SELECTOR = [
    ".KlRXdf",
    ".z3vRcc",
    ".VfPpkd-aPP78e",
    "[data-drive-id]",
    "[data-id][data-item-id]"
  ].join(", ");
  const DRIVE_URL_PATTERNS = [
    /https:\/\/drive\.google\.com\/file\/d\//,
    /https:\/\/drive\.google\.com\/open\?/,
    /https:\/\/drive\.google\.com\/uc\?/,
    /https:\/\/classroom\.google\.com\/drive\//
  ];
  let scanTimeoutId = null;
  let observer = null;
  let nextRequestSeq = 1;
  const pendingButtons = /* @__PURE__ */ new Map();
  function isGoogleClassroom() {
    if (typeof location === "undefined") return false;
    if (location.hostname !== "classroom.google.com") return false;
    return CLASSROOM_URL_PATTERN.test(location.href);
  }
  function scheduleScan() {
    if (scanTimeoutId !== null) {
      window.clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = window.setTimeout(() => {
      scanTimeoutId = null;
      scanForAttachments(document);
    }, RESCAN_DEBOUNCE_MS);
  }
  function setupObservers() {
    if (typeof document === "undefined") return;
    if (!document.body) {
      window.addEventListener(
        "DOMContentLoaded",
        () => setupObservers(),
        { once: true }
      );
      return;
    }
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const roots = /* @__PURE__ */ new Set();
      let shouldScan = false;
      for (const m of mutations) {
        if (m.type !== "childList") continue;
        const isInternal = Array.from(m.addedNodes).some(
          (n) => n.nodeType === Node.ELEMENT_NODE && n.hasAttribute(INJECTED_ATTR)
        );
        if (isInternal) continue;
        shouldScan = true;
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            roots.add(node);
          }
        });
      }
      if (shouldScan) {
        if (roots.size === 0) {
          scheduleScan();
        } else {
          roots.forEach((root) => scanForAttachments(root));
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    window.setInterval(() => {
      scheduleScan();
    }, RESCAN_INTERVAL_MS);
    scheduleScan();
  }
  function scanForAttachments(root = document) {
    if (!isGoogleClassroom()) return;
    injectSingleFileButtons(root);
  }
  function injectSingleFileButtons(root = document) {
    const anchors = Array.from(
      root.querySelectorAll(DRIVE_ANCHOR_SELECTOR)
    );
    for (const anchor of anchors) {
      const url = extractDriveUrlFromAnchor(anchor);
      if (!url) continue;
      const container = anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) || anchor.parentElement || anchor;
      if (!container) continue;
      if (hasInjectedButton(container)) continue;
      injectButtonIntoAttachment(container, url);
    }
    const metaElements = Array.from(
      root.querySelectorAll(
        "[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]"
      )
    );
    for (const el of metaElements) {
      if (hasInjectedButton(el)) continue;
      const url = findDriveUrl(el);
      if (!url) continue;
      injectButtonIntoAttachment(el, url);
    }
  }
  function hasInjectedButton(container) {
    return !!container.querySelector(`[${INJECTED_ATTR}="true"]`);
  }
  function extractDriveUrlFromAnchor(anchor) {
    const href = anchor.href;
    if (!href) return null;
    return DRIVE_URL_PATTERNS.some((re) => re.test(href)) ? href : null;
  }
  function findDriveUrl(element) {
    const nearAnchor = element.querySelector(DRIVE_ANCHOR_SELECTOR) || element.closest(DRIVE_ANCHOR_SELECTOR);
    if (nearAnchor) {
      const href = extractDriveUrlFromAnchor(nearAnchor);
      if (href) return href;
    }
    const driveId = element.getAttribute("data-drive-id") || element.getAttribute("data-id");
    if (driveId) {
      return toDownloadUrl(
        `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
          driveId
        )}`
      );
    }
    return null;
  }
  function getAuthUser() {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.has("authuser")) return params.get("authuser");
    if (params.has("u")) return params.get("u");
    const pathMatch = window.location.pathname.match(/\/u\/(\d+)\//);
    if (pathMatch) return pathMatch[1];
    return null;
  }
  function toDownloadUrl(originalUrl, depth = 0) {
    if (depth > 3) return originalUrl;
    const authUser = getAuthUser();
    try {
      const parsed = new URL(originalUrl, location.href);
      const appendAuth = (u) => {
        if (!authUser) return u;
        const newU = new URL(u);
        if (!newU.searchParams.has("authuser")) {
          newU.searchParams.set("authuser", authUser);
        }
        return newU.toString();
      };
      if (parsed.hostname === "drive.google.com") {
        if (parsed.pathname.startsWith("/auth_warmup")) {
          const cont = parsed.searchParams.get("continue");
          if (cont) return toDownloadUrl(cont, depth + 1);
          const id = parsed.searchParams.get("id");
          if (id) return appendAuth(`https://drive.google.com/uc?export=download&id=${id}`);
          return appendAuth(originalUrl);
        }
        const fileMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
        if (fileMatch) {
          return appendAuth(`https://drive.google.com/uc?export=download&id=${fileMatch[1]}`);
        }
        if (parsed.pathname === "/open" || parsed.pathname === "/uc") {
          parsed.searchParams.set("export", "download");
          if (authUser) parsed.searchParams.set("authuser", authUser);
          return parsed.toString();
        }
      }
      if (parsed.hostname === "classroom.google.com" && parsed.pathname.startsWith("/drive")) {
        const id = parsed.searchParams.get("id") || parsed.searchParams.get("resourceId") || parsed.searchParams.get("fileId");
        if (id) return appendAuth(`https://drive.google.com/uc?export=download&id=${id}`);
      }
      return appendAuth(originalUrl);
    } catch {
      return originalUrl;
    }
  }
  function cleanAttachmentName(rawName) {
    if (!rawName) return "";
    let name = rawName.trim();
    const garbageLabels = ["Microsoft Excel", "Microsoft Word", "Microsoft PowerPoint", "Compressed archive", "Binary", "Unknown", "Google Sheets", "Google Docs", "Google Slides", "Text File", "PDF", "Video", "Image", "Audio", "Text", "Word", "Excel", "PowerPoint", "Archive", "Zip", "File", "Document", "Shortcut", "Code"];
    for (const label of garbageLabels) {
      if (name.endsWith(label)) {
        const potential = name.slice(0, -label.length).trim();
        if (potential.length > 0) {
          name = potential;
          break;
        }
      }
    }
    if (name.length > 0 && name.length % 2 === 0) {
      const mid = name.length / 2;
      if (name.slice(0, mid) === name.slice(mid)) return name.slice(0, mid);
    }
    const repeatRegex = /\.([a-zA-Z0-9]{2,10})\1$/i;
    const repeatMatch = name.match(repeatRegex);
    if (repeatMatch) return name.slice(0, -repeatMatch[1].length).trim();
    return name;
  }
  function extractFileMeta(container, url) {
    let name;
    const tooltip = container.getAttribute("data-tooltip") || container.getAttribute("aria-label") || container.getAttribute("title");
    if (tooltip && tooltip.trim()) name = tooltip.trim();
    if (!name) {
      const text = (container.textContent || "").trim();
      if (text) {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0) name = lines[0];
      }
    }
    if (!name) {
      try {
        const u = new URL(url);
        const pathName = decodeURIComponent(u.pathname.split("/").pop() || "");
        if (pathName && pathName.includes(".")) name = pathName;
      } catch {
      }
    }
    if (name) name = cleanAttachmentName(name);
    let ext;
    if (name) {
      const m = name.match(/\.([a-zA-Z0-9]{2,10})$/);
      if (m) ext = m[1].toLowerCase();
    }
    return { name, ext, kind: "other" };
  }
  function injectButtonIntoAttachment(container, url) {
    if (!url) return;
    container.setAttribute(PROCESSED_ATTR, "true");
    const computed = window.getComputedStyle(container);
    if (computed.position === "static") container.style.position = "relative";
    const directUrl = toDownloadUrl(url);
    const fileMeta = extractFileMeta(container, directUrl);
    const button = createDownloadButton(container, directUrl, fileMeta);
    const iconEl = button.querySelector(".cqd-download-icon");
    if (iconEl) iconEl.classList.add("cqd-icon-medium");
    container.appendChild(button);
  }
  function getButtonState(button) {
    if (button.classList.contains("cqd-loading")) return "loading";
    if (button.classList.contains("cqd-trying")) return "trying";
    if (button.classList.contains("cqd-success")) return "success";
    if (button.classList.contains("cqd-error")) return "error";
    return "idle";
  }
  function setButtonState(button, state, options) {
    const icon = button.querySelector(".cqd-download-icon");
    const label = button.querySelector(".cqd-label");
    const errorDetail = button.querySelector(".cqd-error-detail");
    if (!icon || !label || !errorDetail) return;
    button.classList.remove("cqd-loading", "cqd-trying", "cqd-success", "cqd-error");
    icon.classList.remove("cqd-spinner");
    icon.textContent = "";
    button.disabled = false;
    button.style.backgroundColor = "";
    label.textContent = t("download");
    errorDetail.textContent = "";
    icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
    icon.style.backgroundSize = "";
    switch (state) {
      case "idle":
        break;
      case "loading":
      case "trying": {
        const isTrying = state === "trying";
        button.classList.add(isTrying ? "cqd-trying" : "cqd-loading");
        button.disabled = true;
        label.textContent = isTrying ? t("trying") : t("downloading");
        icon.classList.add("cqd-spinner");
        icon.style.backgroundImage = "none";
        break;
      }
      case "success":
        button.classList.add("cqd-success");
        label.textContent = t("downloaded");
        icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        break;
      case "error":
        button.classList.add("cqd-error");
        label.textContent = t("error");
        icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        errorDetail.textContent = options?.userMessage || t("failed");
        break;
    }
  }
  function setPillProgress(button, fraction) {
    const clamped = Math.max(0, Math.min(1, fraction || 0));
    button.style.setProperty("--cqd-progress", `${clamped * 100}%`);
  }
  function createDownloadButton(_container, url, fileMeta) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqd-download-btn";
    if (isPageDark()) {
      button.classList.add("cqd-theme-dark");
    }
    button.setAttribute(INJECTED_ATTR, "true");
    button.setAttribute("aria-label", `${t("ariaDownload")} ${fileMeta.name || ""}`);
    button.setAttribute("title", t("titleQuick"));
    try {
      if (url) button.dataset.cqdUrl = url;
      if (fileMeta?.name) button.dataset.cqdName = fileMeta.name;
      if (fileMeta?.ext) button.dataset.cqdExt = fileMeta.ext;
    } catch {
    }
    const iconWrapper = document.createElement("span");
    iconWrapper.className = "cqd-icon-wrapper";
    const iconSpan = document.createElement("span");
    iconSpan.className = "cqd-download-icon";
    iconWrapper.appendChild(iconSpan);
    const label = document.createElement("span");
    label.className = "cqd-label";
    label.textContent = t("download");
    const errorDetail = document.createElement("span");
    errorDetail.className = "cqd-error-detail";
    button.appendChild(iconWrapper);
    button.appendChild(label);
    button.appendChild(errorDetail);
    const clickHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleSingleDownloadClick(button, url, fileMeta);
    };
    button.addEventListener("click", clickHandler);
    button.addEventListener("auxclick", (e) => {
      if (e.button === 1) clickHandler(e);
    });
    return button;
  }
  async function handleSingleDownloadClick(button, url, fileMeta) {
    if (!url) return;
    if (getButtonState(button) !== "idle") return;
    setPillProgress(button, 0);
    const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
    const startedAt = Date.now();
    pendingButtons.set(requestId, { button, requestId, fileMeta, startedAt });
    setButtonState(button, "loading");
    const startResult = await startBackgroundDownload(requestId, url, fileMeta);
    if (!startResult.ok) {
      pendingButtons.delete(requestId);
      await ensureMinLoading(startedAt);
      await showErrorState(button, startResult.userMessage);
      return;
    }
  }
  function startBackgroundDownload(requestId, url, fileMeta) {
    const finalUrl = toDownloadUrl(url);
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        resolve({ ok: false, userMessage: "Runtime not available." });
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { type: "CQD_DOWNLOAD", url: finalUrl, requestId, fileMeta },
          (response) => {
            if (chrome.runtime.lastError || !response || response.started === false) {
              resolve({ ok: false, userMessage: response?.userMessage || "Could not start." });
            } else {
              resolve({ ok: true });
            }
          }
        );
      } catch {
        resolve({ ok: false, userMessage: "Comm error." });
      }
    });
  }
  async function showErrorState(button, userMessage) {
    setButtonState(button, "error", { userMessage });
    const earliestReset = Date.now() + FEEDBACK_ERROR_MS;
    while (true) {
      await delay(200);
      if (getButtonState(button) !== "error") return;
      if (Date.now() < earliestReset) continue;
      if (!button.matches(":hover")) {
        setButtonState(button, "idle");
        setPillProgress(button, 0);
        return;
      }
    }
  }
  async function ensureMinLoading(startedAt) {
    const elapsed = Date.now() - startedAt;
    if (elapsed < LOADING_MIN_MS) await delay(LOADING_MIN_MS - elapsed);
  }
  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== "CQD_DOWNLOAD_STATUS") return;
      const requestId = message.requestId;
      if (!requestId) return;
      const pending = pendingButtons.get(requestId);
      if (!pending) return;
      const { button, startedAt } = pending;
      (async () => {
        await ensureMinLoading(startedAt);
        const status = message.status;
        const errorCode = message.errorCode;
        const userMessage = message.userMessage;
        if (status === "trying") {
          setButtonState(button, "trying", { userMessage });
          return;
        }
        if (status === "success" || status === "complete") {
          pendingButtons.delete(requestId);
          try {
            button.dataset.cqdAllDone = "true";
          } catch {
          }
          setPillProgress(button, 1);
          setButtonState(button, "success");
          await delay(FEEDBACK_SUCCESS_MS);
          if (getButtonState(button) === "success") {
            setButtonState(button, "idle");
            setPillProgress(button, 0);
            try {
              delete button.dataset.cqdAllDone;
            } catch {
            }
          }
          return;
        }
        if (status === "error" || status === "interrupted" || status === "blocked_html") {
          if (errorCode === "AUTH_CHECK") {
            await showErrorState(button, userMessage);
            return;
          }
          pendingButtons.delete(requestId);
          setPillProgress(button, 0);
          await showErrorState(button, userMessage);
        }
      })();
    });
  }
  function initContentScript() {
    if (!isGoogleClassroom()) return;
    injectStyles();
    setupObservers();
  }
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      initContentScript();
    }
  });
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function print$1(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  class WxtLocationChangeEvent extends Event {
    constructor(newUrl, oldUrl) {
      super(WxtLocationChangeEvent.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
    static EVENT_NAME = getUniqueEventName("wxt:locationchange");
  }
  function getUniqueEventName(eventName) {
    return `${browser?.runtime?.id}:${"content"}:${eventName}`;
  }
  function createLocationWatcher(ctx) {
    let interval;
    let oldUrl;
    return {
      /**
       * Ensure the location watcher is actively looking for URL changes. If it's already watching,
       * this is a noop.
       */
      run() {
        if (interval != null) return;
        oldUrl = new URL(location.href);
        interval = ctx.setInterval(() => {
          let newUrl = new URL(location.href);
          if (newUrl.href !== oldUrl.href) {
            window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
            oldUrl = newUrl;
          }
        }, 1e3);
      }
    };
  }
  class ContentScriptContext {
    constructor(contentScriptName, options) {
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.abortController = new AbortController();
      if (this.isTopFrame) {
        this.listenForNewerScripts({ ignoreFirstEvent: true });
        this.stopOldScripts();
      } else {
        this.listenForNewerScripts();
      }
    }
    static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName(
      "wxt:content-script-started"
    );
    isTopFrame = window.self === window.top;
    abortController;
    locationWatcher = createLocationWatcher(this);
    receivedMessageIds = /* @__PURE__ */ new Set();
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      if (browser.runtime.id == null) {
        this.notifyInvalidated();
      }
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
     * Add a listener that is called when the content script's context is invalidated.
     *
     * @returns A function to remove the listener.
     *
     * @example
     * browser.runtime.onMessage.addListener(cb);
     * const removeInvalidatedListener = ctx.onInvalidated(() => {
     *   browser.runtime.onMessage.removeListener(cb);
     * })
     * // ...
     * removeInvalidatedListener();
     */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
     * Return a promise that never resolves. Useful if you have an async function that shouldn't run
     * after the context is expired.
     *
     * @example
     * const getValueFromStorage = async () => {
     *   if (ctx.isInvalid) return ctx.block();
     *
     *   // ...
     * }
     */
    block() {
      return new Promise(() => {
      });
    }
    /**
     * Wrapper around `window.setInterval` that automatically clears the interval when invalidated.
     *
     * Intervals can be cleared by calling the normal `clearInterval` function.
     */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
     * Wrapper around `window.setTimeout` that automatically clears the interval when invalidated.
     *
     * Timeouts can be cleared by calling the normal `setTimeout` function.
     */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
     * Wrapper around `window.requestAnimationFrame` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelAnimationFrame` function.
     */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
     * Wrapper around `window.requestIdleCallback` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelIdleCallback` function.
     */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      target.addEventListener?.(
        type.startsWith("wxt:") ? getUniqueEventName(type) : type,
        handler,
        {
          ...options,
          signal: this.signal
        }
      );
    }
    /**
     * @internal
     * Abort the abort controller and execute all `onInvalidated` listeners.
     */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(
        `Content script "${this.contentScriptName}" context invalidated`
      );
    }
    stopOldScripts() {
      window.postMessage(
        {
          type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
          contentScriptName: this.contentScriptName,
          messageId: Math.random().toString(36).slice(2)
        },
        "*"
      );
    }
    verifyScriptStartedEvent(event) {
      const isScriptStartedEvent = event.data?.type === ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE;
      const isSameContentScript = event.data?.contentScriptName === this.contentScriptName;
      const isNotDuplicate = !this.receivedMessageIds.has(event.data?.messageId);
      return isScriptStartedEvent && isSameContentScript && isNotDuplicate;
    }
    listenForNewerScripts(options) {
      let isFirst = true;
      const cb = (event) => {
        if (this.verifyScriptStartedEvent(event)) {
          this.receivedMessageIds.add(event.data.messageId);
          const wasFirst = isFirst;
          isFirst = false;
          if (wasFirst && options?.ignoreFirstEvent) return;
          this.notifyInvalidated();
        }
      };
      addEventListener("message", cb);
      this.onInvalidated(() => removeEventListener("message", cb));
    }
  }
  function initPlugins() {
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      const ctx = new ContentScriptContext("content", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"content"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9pbmRleC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcblxuaW1wb3J0IHsgRE9XTkxPQURfSUNPTl9TVkdfVVJMIH0gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IFNUWUxFX0lEID0gJ2NxZC1zdHlsZSc7XG5jb25zdCBTUElOTkVSX1NJWkVfUFggPSAxNjtcblxuY29uc3QgVFJBTlNJVElPTl9NUyA9IDE1MDtcbmNvbnN0IFRSQU5TSVRJT05fU1RSID0gYCR7VFJBTlNJVElPTl9NU31tcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKWA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIDpyb290IHtcbiAgICAgIC0tY3FkLXRyYW5zaXRpb246ICR7VFJBTlNJVElPTl9TVFJ9O1xuXG4gICAgICAvKiBTcGlubmVyICovXG4gICAgICAtLWNxZC1zcGlubmVyLWJvcmRlcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjZmZmZmZmO1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAoTGlnaHQpXG4gICAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA1REQ3O1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDkzLCAyMTUsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgOTMsIDIxNSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwMEE4MkQ7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0VDNjMwMDtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjM2LCA5OSwgMCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwN0Y4RDtcblxuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIERBUksgTU9ERVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC10aGVtZS1kYXJrIHtcbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwN0RBM0Y7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7XG4gICAgfVxuXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gKFNpbmdsZSlcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA1MCU7XG4gICAgICByaWdodDogOHB4O1xuICAgICAgei1pbmRleDogNTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IGNhbGMoMTAwJSAtIDE2cHgpO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1ub3JtYWwpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWJhc2UpO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHBhZGRpbmctaW5saW5lIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm9yZGVyLXJhZGl1cyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciB7XG4gICAgICB3aWR0aDogMTIwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjphY3RpdmUge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDAuOTcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWFyZ2luLWxlZnQ6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtd2lkdGg6IDExMHB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbCk7XG4gICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyB7XG4gICAgICB3aWR0aDogMTEwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItdHJ5aW5nKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAxMnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIHtcbiAgICAgIHdpZHRoOiAxNDBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3M6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA4cHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHdpZHRoOiA5MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiAxNTBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDQwcHg7XG4gICAgICBwYWRkaW5nLXRvcDogMDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiAwO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMztcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAzNTBweDtcbiAgICAgIG1heC13aWR0aDogMzYwcHg7XG4gICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA2MXB4O1xuICAgICAgcGFkZGluZzogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICB9XG5cbiAgICAuY3FkLXNwaW5uZXIge1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIHdpZHRoOiAke1NQSU5ORVJfU0laRV9QWH1weDtcbiAgICAgIGhlaWdodDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBib3JkZXI6IDNweCBzb2xpZCB2YXIoLS1jcWQtc3Bpbm5lci1ib3JkZXIpO1xuICAgICAgYm9yZGVyLXRvcC1jb2xvcjogdmFyKC0tY3FkLXNwaW5uZXItdG9wKTtcbiAgICAgIGFuaW1hdGlvbjogY3FkLXNwaW4gMC42NXMgbGluZWFyIGluZmluaXRlO1xuICAgIH1cblxuICAgIEBrZXlmcmFtZXMgY3FkLXNwaW4ge1xuICAgICAgZnJvbSB7IHRyYW5zZm9ybTogcm90YXRlKDBkZWcpOyB9XG4gICAgICB0byB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH1cbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMi4gQ09NTUVOVFMgJiBFRElURUQgKE92ZXJsYXkpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICBib3JkZXItcmFkaXVzOiBpbmhlcml0O1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1jb21tZW50KSxcbiAgICAgICAgMCAwIDEycHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNSk7XG4gICAgfVxuXG4gICAgLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWNvbW1lbnQpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSwgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgLmNxZC1jb21tZW50LWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDApIGludmVydCgxKTtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICB9XG5cbiAgICAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01cHgpO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIuY3FkLWVkaXRlZCB7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCksXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMCwgMjE0LCAyMzgsIDAuMyk7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItZWRpdGVkKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTBweCk7XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRpZmYtdmFsIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIGRpdltkYXRhLXN0cmVhbS1pdGVtLWlkXVtkYXRhLWNxZC1wcm9jZXNzZWRdW2RhdGEtY3FkLWVkaXRlZC1wcm9jZXNzZWRdID4gLmNxZC1vdmVybGF5LWNvbnRhaW5lciB7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggI0ZGNDAzNixcbiAgICAgICAgMCAwIDEycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiA3MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogI0ZGNDAzNjtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgcGFkZGluZy10b3A6IDhweDtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1zZWN0aW9uIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1pY29uIHtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtaWNvbi1lZGl0ZWQgc3ZnIHtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgc3Ryb2tlOiBjdXJyZW50Q29sb3I7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXBsdXMge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgbWFyZ2luOiA1cHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlLFxuICAgIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1heC1oZWlnaHQgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWFyZ2luLXRvcCAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiAxMjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDRweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMWIuIERPV05MT0FEIEFMTCBCVVRUT04gKFJlZGVzaWduZWQgJiBSZXBvc2l0aW9uZWQpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIHtcbiAgICAgIC8qIFByb2dyZXNzIGNvbnRyb2wgKDAlIHRvIDEwMCUpICovXG4gICAgICAtLWNxZC1wcm9ncmVzczogMCU7XG5cbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIC8qIFBvc2l0aW9uaW5nIGluIEhlYWRlciBhcmVhIChhcHByb3ggbGVmdCBvZiAzLWRvdHMpICovXG4gICAgICB0b3A6IC04MHB4O1xuICAgICAgcmlnaHQ6IDQ4cHg7XG4gICAgICB6LWluZGV4OiA2O1xuXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDRweCAxMnB4O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuXG4gICAgICAvKiBTb2xpZCBDb2xvcnMgKE5vIEJsdXIpICovXG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuXG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiU2Vnb2UgVUlcIiwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTJweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBnYXA6IDZweDtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuXG4gICAgICBoZWlnaHQ6IDQwcHg7IC8qIE1hdGNoIHNpbmdsZS1kb3dubG9hZCBidXR0b24gaGVpZ2h0ICovXG5cbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xcyBlYXNlLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIDAuM3MgZWFzZTtcblxuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVaKDApO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZG93bmxvYWQtYWxsLWJ0biB7XG4gICAgICByaWdodDogYXV0bztcbiAgICAgIGxlZnQ6IDQ4cHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuOm5vdCg6ZGlzYWJsZWQpOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xcHgpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0bjpub3QoOmRpc2FibGVkKTphY3RpdmUge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0bjpkaXNhYmxlZCB7XG4gICAgICBjdXJzb3I6IGRlZmF1bHQ7XG4gICAgICBvcGFjaXR5OiAwLjc7XG4gICAgICBib3gtc2hhZG93OiBub25lO1xuICAgICAgdHJhbnNmb3JtOiBub25lO1xuICAgIH1cblxuICAgIC8qIEZVTEwgU1VDQ0VTUyBTVEFURSAoU29saWQgR3JlZW4pICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuLmNxZC1hbGwtc3VjY2VzcyB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtYWxsLWVycm9yIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lcnJvcik7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yKTtcbiAgICB9XG5cbiAgICAvKiBQUk9HUkVTUyBCQVIgT1ZFUkxBWSAoRmlsbHMgdXApICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuOjphZnRlciB7XG4gICAgICBjb250ZW50OiAnJztcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMDtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICB6LWluZGV4OiAwO1xuXG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG5cbiAgICAgIC8qIFdpZHRoIGNvbnRyb2xsZWQgYnkgSlMgKi9cbiAgICAgIHdpZHRoOiB2YXIoLS1jcWQtcHJvZ3Jlc3MpO1xuICAgICAgdHJhbnNpdGlvbjogd2lkdGggMC4zcyBjdWJpYy1iZXppZXIoMC4yMiwgMC42MSwgMC4zNiwgMSk7XG5cbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgfVxuXG4gICAgLyogV2hlbiBmdWxseSBzdWNjZXNzZnVsLCB0aGUgbWFpbiBiZyBiZWNvbWVzIGdyZWVuIGFueXdheSwgc28gd2UgY2FuIGhpZGUgcHJvZ3Jlc3MgKi9cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1zdWNjZXNzOjphZnRlciB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgIH1cblxuICAgIC8qIENvbnRlbnQgbGF5ZXJzICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4sXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLXN1YixcbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtaWNvbi13cmFwcGVyIHtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHotaW5kZXg6IDI7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtaWNvbiB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE4cHggMThweDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLW1haW4ge1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1zdWIge1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgb3BhY2l0eTogMC45O1xuICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICB9XG5cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG4iLCJjb25zdCBUUkFOU0xBVElPTlM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gIGVuOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdEb3dubG9hZGluZ+KApicsXG4gICAgdHJ5aW5nOiAnVHJ5aW5n4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRG93bmxvYWRlZCcsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnRG93bmxvYWQgZmFpbGVkLicsXG4gICAgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdRdWljayBkb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdjb21tZW50cycsXG4gICAgZWRpdGVkOiAnRWRpdGVkJyxcbiAgICBkb3dubG9hZEFsbDogJ0Rvd25sb2FkIGFsbCcsXG4gIH0sXG4gIGFyOiB7XG4gICAgZG93bmxvYWQ6ICfYqtmG2LLZitmEJyxcbiAgICBkb3dubG9hZGluZzogJ9is2KfYsdmKINin2YTYqtmG2LLZitmE4oCmJyxcbiAgICB0cnlpbmc6ICfZhdit2KfZiNmE2KnigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfYqtmFINin2YTYqtmG2LLZitmEJyxcbiAgICBlcnJvcjogJ9iu2LfYoycsXG4gICAgZmFpbGVkOiAn2YHYtNmEINin2YTYqtmG2LLZitmELicsXG4gICAgYXJpYURvd25sb2FkOiAn2KrZhtiy2YrZhCcsXG4gICAgdGl0bGVRdWljazogJ9iq2YbYstmK2YQg2LPYsdmK2LknLFxuICAgIGNvbW1lbnRzOiAn2KrYudmE2YrZgtin2KonLFxuICAgIGVkaXRlZDogJ9iq2YUg2KfZhNiq2LnYr9mK2YQnLFxuICAgIGRvd25sb2FkQWxsOiAn2KrZhtiy2YrZhCDYp9mE2YPZhCcsXG4gIH0sXG4gIGphOiB7XG4gICAgZG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLFxuICAgIGRvd25sb2FkaW5nOiAnREzkuK3igKYnLFxuICAgIHRyeWluZzogJ+ippuihjOS4reKApicsXG4gICAgZG93bmxvYWRlZDogJ+WujOS6hicsXG4gICAgZXJyb3I6ICfjgqjjg6njg7wnLFxuICAgIGZhaWxlZDogJ+WkseaVl+OBl+OBvuOBl+OBn+OAgicsXG4gICAgYXJpYURvd25sb2FkOiAn44OA44Km44Oz44Ot44O844OJJyxcbiAgICB0aXRsZVF1aWNrOiAn44Kv44Kk44OD44Kv44OA44Km44Oz44Ot44O844OJJyxcbiAgICBjb21tZW50czogJ+S7tuOBruOCs+ODoeODs+ODiCcsXG4gICAgZWRpdGVkOiAn57eo6ZuG5riI44G/JyxcbiAgfSxcbiAgZXM6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsXG4gICAgdHJ5aW5nOiAnSW50ZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcmdhZG8nLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0ZhbGzDsyBsYSBkZXNjYXJnYS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICBoaToge1xuICAgIGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoeCkv+CkguCkl+KApicsXG4gICAgdHJ5aW5nOiAn4KSV4KWL4KS24KS/4KS2IOCknOCkvuCksOClgOKApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCljeCkoycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLFxuICAgIGZhaWxlZDogJ+CkteCkv+Ckq+CksiDgpLDgpLngpL4nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KS/4KSv4KS+4KSBJyxcbiAgICBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnLFxuICB9LFxuICBwdDoge1xuICAgIGRvd25sb2FkOiAnQmFpeGFyJyxcbiAgICBkb3dubG9hZGluZzogJ0JhaXhhbmRv4oCmJyxcbiAgICB0cnlpbmc6ICdUZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0JhaXhhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsaGEgYW8gYmFpeGFyLicsXG4gICAgYXJpYURvd25sb2FkOiAnQmFpeGFyJyxcbiAgICB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcsOhcGlkbycsXG4gICAgY29tbWVudHM6ICdjb21lbnTDoXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICAncHQtcHQnOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJyZWdhcicsXG4gICAgZG93bmxvYWRpbmc6ICdBIGRlc2NhcnJlZ2Fy4oCmJyxcbiAgICB0cnlpbmc6ICdBIHRlbnRhcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2FkbycsXG4gICAgZXJyb3I6ICdFcnJvJyxcbiAgICBmYWlsZWQ6ICdGYWxoYSBhbyBkZXNjYXJyZWdhci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnTDoXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICAnemgtY24nOiB7XG4gICAgZG93bmxvYWQ6ICfkuIvovb0nLFxuICAgIGRvd25sb2FkaW5nOiAn5LiL6L295Lit4oCmJyxcbiAgICB0cnlpbmc6ICflsJ3or5XkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflt7LkuIvovb0nLFxuICAgIGVycm9yOiAn6ZSZ6K+vJyxcbiAgICBmYWlsZWQ6ICfkuIvovb3lpLHotKUnLFxuICAgIGFyaWFEb3dubG9hZDogJ+S4i+i9vScsXG4gICAgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i9vScsXG4gICAgY29tbWVudHM6ICfmnaHor4TorronLFxuICAgIGVkaXRlZDogJ+W3sue8lui+kScsXG4gIH0sXG4gICd6aC10dyc6IHtcbiAgICBkb3dubG9hZDogJ+S4i+i8iScsXG4gICAgZG93bmxvYWRpbmc6ICfkuIvovInkuK3igKYnLFxuICAgIHRyeWluZzogJ+WYl+ippuS4reKApicsXG4gICAgZG93bmxvYWRlZDogJ+W3suS4i+i8iScsXG4gICAgZXJyb3I6ICfpjK/oqqQnLFxuICAgIGZhaWxlZDogJ+S4i+i8ieWkseaVlycsXG4gICAgYXJpYURvd25sb2FkOiAn5LiL6LyJJyxcbiAgICB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6LyJJyxcbiAgICBjb21tZW50czogJ+WJh+eVmeiogCcsXG4gICAgZWRpdGVkOiAn5bey57eo6LyvJyxcbiAgfSxcbiAgZnI6IHtcbiAgICBkb3dubG9hZDogJ1TDqWzDqWNoYXJnZXInLFxuICAgIGRvd25sb2FkaW5nOiAnVMOpbMOpY2hhcmdlbWVudOKApicsXG4gICAgdHJ5aW5nOiAnRXNzYWnigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUw6lsw6ljaGFyZ8OpJyxcbiAgICBlcnJvcjogJ0VycmV1cicsXG4gICAgZmFpbGVkOiAnw4ljaGVjLicsXG4gICAgYXJpYURvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsXG4gICAgdGl0bGVRdWljazogJ1TDqWzDqWNoYXJnZW1lbnQgcmFwaWRlJyxcbiAgICBjb21tZW50czogJ2NvbW1lbnRhaXJlcycsXG4gICAgZWRpdGVkOiAnTW9kaWZpw6knLFxuICB9LFxuICBkZToge1xuICAgIGRvd25sb2FkOiAnSGVydW50ZXJsYWRlbicsXG4gICAgZG93bmxvYWRpbmc6ICdMYWRlbuKApicsXG4gICAgdHJ5aW5nOiAnVmVyc3VjaGVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmVydGlnJyxcbiAgICBlcnJvcjogJ0ZlaGxlcicsXG4gICAgZmFpbGVkOiAnRmVobGdlc2NobGFnZW4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJyxcbiAgICB0aXRsZVF1aWNrOiAnU2NobmVsbGVyIERvd25sb2FkJyxcbiAgICBjb21tZW50czogJ0tvbW1lbnRhcmUnLFxuICAgIGVkaXRlZDogJ0JlYXJiZWl0ZXQnLFxuICB9LFxuICBpdDoge1xuICAgIGRvd25sb2FkOiAnU2NhcmljYScsXG4gICAgZG93bmxvYWRpbmc6ICdTY2FyaWNhbWVudG/igKYnLFxuICAgIHRyeWluZzogJ1Byb3ZhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2NhcmljYXRvJyxcbiAgICBlcnJvcjogJ0Vycm9yZScsXG4gICAgZmFpbGVkOiAnRmFsbGl0by4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1NjYXJpY2EnLFxuICAgIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByYXBpZG8nLFxuICAgIGNvbW1lbnRzOiAnY29tbWVudGknLFxuICAgIGVkaXRlZDogJ01vZGlmaWNhdG8nLFxuICB9LFxuICBydToge1xuICAgIGRvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLFxuICAgIGRvd25sb2FkaW5nOiAn0KHQutCw0YfQuNCy0LDQvdC40LXigKYnLFxuICAgIHRyeWluZzogJ9Cf0L7Qv9GL0YLQutCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0KHQutCw0YfQsNC90L4nLFxuICAgIGVycm9yOiAn0J7RiNC40LHQutCwJyxcbiAgICBmYWlsZWQ6ICfQodCx0L7QuS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Ch0LrQsNGH0LDRgtGMJyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRi9GB0YLRgNC+0LUg0YHQutCw0YfQuNCy0LDQvdC40LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LzQtdC90YLQsNGA0LjQtdCyJyxcbiAgICBlZGl0ZWQ6ICfQmNC30LzQtdC90LXQvdC+JyxcbiAgfSxcbiAga286IHtcbiAgICBkb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsXG4gICAgZG93bmxvYWRpbmc6ICfri6TsmrTroZzrk5wg7KSR4oCmJyxcbiAgICB0cnlpbmc6ICfsi5zrj4Qg7KSR4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn7JmE66OMJyxcbiAgICBlcnJvcjogJ+yYpOulmCcsXG4gICAgZmFpbGVkOiAn7Iuk7Yyo7ZWoJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfri6TsmrTroZzrk5wnLFxuICAgIHRpdGxlUXVpY2s6ICfruaDrpbgg64uk7Jq066Gc65OcJyxcbiAgICBjb21tZW50czogJ+qwnCDrjJPquIAnLFxuICAgIGVkaXRlZDogJ+yImOygleuQqCcsXG4gIH0sXG4gIHRyOiB7XG4gICAgZG93bmxvYWQ6ICfEsG5kaXInLFxuICAgIGRvd25sb2FkaW5nOiAnxLBuZGlyaWxpeW9y4oCmJyxcbiAgICB0cnlpbmc6ICdEZW5lbml5b3LigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfEsG5kaXJpbGRpJyxcbiAgICBlcnJvcjogJ0hhdGEnLFxuICAgIGZhaWxlZDogJ0JhxZ9hcsSxc8Sxei4nLFxuICAgIGFyaWFEb3dubG9hZDogJ8SwbmRpcicsXG4gICAgdGl0bGVRdWljazogJ0jEsXpsxLEgaW5kaXInLFxuICAgIGNvbW1lbnRzOiAneW9ydW0nLFxuICAgIGVkaXRlZDogJ0TDvHplbmxlbmRpJyxcbiAgfSxcbiAgdmk6IHtcbiAgICBkb3dubG9hZDogJ1ThuqNpIHh14buRbmcnLFxuICAgIGRvd25sb2FkaW5nOiAnxJBhbmcgdOG6o2nigKYnLFxuICAgIHRyeWluZzogJ8SQYW5nIHRo4but4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnxJDDoyB04bqjaScsXG4gICAgZXJyb3I6ICdM4buXaScsXG4gICAgZmFpbGVkOiAnVGjhuqV0IGLhuqFpLicsXG4gICAgYXJpYURvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsXG4gICAgdGl0bGVRdWljazogJ1ThuqNpIHh14buRbmcgbmhhbmgnLFxuICAgIGNvbW1lbnRzOiAnbmjhuq1uIHjDqXQnLFxuICAgIGVkaXRlZDogJ8SQw6MgY2jhu4luaCBz4butYScsXG4gIH0sXG4gIGlkOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdNZW5ndW5kdWjigKYnLFxuICAgIHRyeWluZzogJ01lbmNvYmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTZWxlc2FpJyxcbiAgICBlcnJvcjogJ0tlc2FsYWhhbicsXG4gICAgZmFpbGVkOiAnR2FnYWwuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgdGl0bGVRdWljazogJ0Rvd25sb2FkIGNlcGF0JyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyJyxcbiAgICBlZGl0ZWQ6ICdEaWVkaXQnLFxuICB9LFxuICB0aDoge1xuICAgIGRvd25sb2FkOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiUJyxcbiAgICBkb3dubG9hZGluZzogJ+C4geC4s+C4peC4seC4h+C5guC4q+C4peC4lOKApicsXG4gICAgdHJ5aW5nOiAn4Lie4Lii4Liy4Lii4Liy4Lih4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LmA4Liq4Lij4LmH4LiI4Liq4Li04LmJ4LiZJyxcbiAgICBlcnJvcjogJ+C4guC5ieC4reC4nOC4tOC4lOC4nuC4peC4suC4lCcsXG4gICAgZmFpbGVkOiAn4Lil4LmJ4Lih4LmA4Lir4Lil4LinJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLFxuICAgIHRpdGxlUXVpY2s6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJTguJTguYjguKfguJknLFxuICAgIGNvbW1lbnRzOiAn4LiE4Lin4Liy4Lih4LiE4Li04LiU4LmA4Lir4LmH4LiZJyxcbiAgICBlZGl0ZWQ6ICfguYHguIHguYnguYTguILguYHguKXguYnguKcnLFxuICB9LFxuICBwbDoge1xuICAgIGRvd25sb2FkOiAnUG9iaWVyeicsXG4gICAgZG93bmxvYWRpbmc6ICdQb2JpZXJhbmll4oCmJyxcbiAgICB0cnlpbmc6ICdQcsOzYmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdQb2JyYW5vJyxcbiAgICBlcnJvcjogJ0LFgsSFZCcsXG4gICAgZmFpbGVkOiAnTmlldWRhbmUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQb2JpZXJ6JyxcbiAgICB0aXRsZVF1aWNrOiAnU3p5YmtpZSBwb2JpZXJhbmllJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyemUnLFxuICAgIGVkaXRlZDogJ0VkeXRvd2FubycsXG4gIH0sXG4gIG5sOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZGVuJyxcbiAgICBkb3dubG9hZGluZzogJ0Rvd25sb2FkZW7igKYnLFxuICAgIHRyeWluZzogJ1Byb2JlcmVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhYXInLFxuICAgIGVycm9yOiAnRm91dCcsXG4gICAgZmFpbGVkOiAnTWlzbHVrdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkZW4nLFxuICAgIHRpdGxlUXVpY2s6ICdTbmVsIGRvd25sb2FkZW4nLFxuICAgIGNvbW1lbnRzOiAncmVhY3RpZXMnLFxuICAgIGVkaXRlZDogJ0Jld2Vya3QnLFxuICB9LFxuICBibjoge1xuICAgIGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCmsuCni+CmoSDgprngpprgp43gppvgp4figKYnLFxuICAgIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgprDgppvgp4figKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgprjgpq7gp43gpqrgpqjgp43gpqgnLFxuICAgIGVycm9yOiAn4Kak4KeN4Kaw4KeB4Kaf4Ka/JyxcbiAgICBmYWlsZWQ6ICfgpqzgp43gpq/gprDgp43gpqUg4Ka54Kav4Ka84KeH4Kab4KeHJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpqbgp43gprDgp4HgpqQg4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICBjb21tZW50czogJ+Cmn+CmvyDgpq7gpqjgp43gpqTgpqzgp43gpq8nLFxuICAgIGVkaXRlZDogJ+CmuOCmruCnjeCmquCmvuCmpuCmv+CmpCcsXG4gIH0sXG4gIHBhOiB7XG4gICAgZG93bmxvYWQ6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihIOCoueCpiyDgqLDgqL/gqLngqL7igKYnLFxuICAgIHRyeWluZzogJ+ColeCpi+CouOCovOCov+CouOCovCDgqJzgqL7gqLDgqYDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgqK7gqYHgqJXgqbDgqK7gqLInLFxuICAgIGVycm9yOiAn4KiX4Kiy4Kik4KmAJyxcbiAgICBmYWlsZWQ6ICfgqIXgqLjgqKvgqLInLFxuICAgIGFyaWFEb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsXG4gICAgdGl0bGVRdWljazogJ+CopOCph+ConOCovCDgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIGNvbW1lbnRzOiAn4Kif4Ki/4Kmx4Kiq4Kij4KmA4KiG4KiCJyxcbiAgICBlZGl0ZWQ6ICfgqLjgqbDgqKrgqL7gqKbgqL/gqKQnLFxuICB9LFxuICB0ZToge1xuICAgIGRvd25sb2FkOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJyxcbiAgICBkb3dubG9hZGluZzogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjSDgsIXgsLXgsYHgsKTgsYvgsILgsKbgsL/igKYnLFxuICAgIHRyeWluZzogJ+CwquCxjeCwsOCwr+CwpOCxjeCwqOCwv+CwuOCxjeCwpOCxi+CwguCwpuCwv+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CwquCxguCwsOCxjeCwpOCwr+Cwv+CwguCwpuCwvycsXG4gICAgZXJyb3I6ICfgsLLgsYvgsKrgsIInLFxuICAgIGZhaWxlZDogJ+CwteCwv+Cwq+CwsuCwruCxiOCwguCwpuCwvycsXG4gICAgYXJpYURvd25sb2FkOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJyxcbiAgICB0aXRsZVF1aWNrOiAn4LCk4LGN4LC14LCw4LC/4LCkIOCwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgY29tbWVudHM6ICfgsLXgsY3gsK/gsL7gsJbgsY3gsK/gsLLgsYEnLFxuICAgIGVkaXRlZDogJ+CwuOCwteCwsOCwv+CwguCwmuCwrOCwoeCwv+CwguCwpuCwvycsXG4gIH0sXG4gIG1yOiB7XG4gICAgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueCli+CkpCDgpIbgpLngpYfigKYnLFxuICAgIHRyeWluZzogJ+CkquCljeCksOCkr+CkpOCljeCkqCDgpJXgpLDgpKQg4KSG4KS54KWH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJyxcbiAgICBlcnJvcjogJ+CkpOCljeCksOClgeCkn+ClgCcsXG4gICAgZmFpbGVkOiAn4KSF4KSv4KS24KS44KWN4KS14KWAJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+CljeCkr+CkvicsXG4gICAgZWRpdGVkOiAn4KS44KSC4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgdGE6IHtcbiAgICBkb3dubG9hZDogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCvgScsXG4gICAgZG93bmxvYWRpbmc6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgrqrgr43grqrgrp/gr4HgrpXgrr/grrHgrqTgr4HigKYnLFxuICAgIHRyeWluZzogJ+CuruCvgeCur+CuseCvjeCumuCuv+CuleCvjeCuleCuv+CuseCupOCvgeKApicsXG4gICAgZG93bmxvYWRlZDogJ+CuruCvgeCun+Cuv+CuqOCvjeCupOCupOCvgScsXG4gICAgZXJyb3I6ICfgrqrgrr/grrTgr4gnLFxuICAgIGZhaWxlZDogJ+CupOCvi+CusuCvjeCuteCuvycsXG4gICAgYXJpYURvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJyxcbiAgICB0aXRsZVF1aWNrOiAn4K614K6/4K6w4K+I4K614K+BIOCuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuruCvjScsXG4gICAgY29tbWVudHM6ICfgrpXgrrDgr4HgrqTgr43grqTgr4HgrpXgrrPgr40nLFxuICAgIGVkaXRlZDogJ+CupOCuv+CusOCvgeCupOCvjeCupOCuquCvjeCuquCun+CvjeCun+CupOCvgScsXG4gIH0sXG4gIHVyOiB7XG4gICAgZG93bmxvYWQ6ICfaiNin2KTZhiDZhNmI2ognLFxuICAgIGRvd25sb2FkaW5nOiAn2ojYp9ik2YYg2YTZiNqIINuB2Ygg2LHbgdinINuB25LigKYnLFxuICAgIHRyeWluZzogJ9qp2YjYtNi0INis2KfYsduM4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn2YXaqdmF2YQnLFxuICAgIGVycm9yOiAn2LrZhNi324wnLFxuICAgIGZhaWxlZDogJ9mG2Kfaqdin2YUnLFxuICAgIGFyaWFEb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsXG4gICAgdGl0bGVRdWljazogJ9mB2YjYsduMINqI2KfYpNmGINmE2YjaiCcsXG4gICAgY29tbWVudHM6ICfYqtio2LXYsduSJyxcbiAgICBlZGl0ZWQ6ICfYqtix2YXbjNmFINi02K/bgScsXG4gIH0sXG4gIGd1OiB7XG4gICAgZG93bmxvYWQ6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhIOCqpeCqiCDgqrDgqrngq43gqq/gq4HgqoIg4Kqb4KuH4oCmJyxcbiAgICB0cnlpbmc6ICfgqqrgq43gqrDgqq/gqr7gqrgg4Kqa4Kq+4Kqy4KuB4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Kqq4KuC4Kqw4KuN4KqjJyxcbiAgICBlcnJvcjogJ+CqreCrguCqsicsXG4gICAgZmFpbGVkOiAn4Kqo4Kq/4Kq34KuN4Kqr4KqzJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgqp3gqqHgqqrgq4Ag4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICBjb21tZW50czogJ+Cqn+Cqv+CqquCrjeCqquCqo+CrgOCqkycsXG4gICAgZWRpdGVkOiAn4Kq44KqC4Kqq4Kq+4Kqm4Kq/4KqkJyxcbiAgfSxcbiAga246IHtcbiAgICBkb3dubG9hZDogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsXG4gICAgZG93bmxvYWRpbmc6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40g4LKG4LKX4LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJyxcbiAgICB0cnlpbmc6ICfgsqrgs43gsrDgsq/gsqTgs43gsqjgsr/gsrjgs4HgsqTgs43gsqTgsr/gsqbgs4bigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgsqrgs4LgsrDgs43gsqPgspfgs4rgsoLgsqHgsr/gsqbgs4YnLFxuICAgIGVycm9yOiAn4LKm4LOL4LK3JyxcbiAgICBmYWlsZWQ6ICfgsrXgsr/gsqvgsrLgsrXgsr7gspfgsr/gsqbgs4YnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsXG4gICAgdGl0bGVRdWljazogJ+CypOCzjeCyteCysOCyv+CypCDgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIGNvbW1lbnRzOiAn4LKV4LK+4LKu4LOG4LKC4LKf4LON4oCM4LKX4LKz4LOBJyxcbiAgICBlZGl0ZWQ6ICfgsrjgsoLgsqrgsr7gsqbgsr/gsrjgsrLgsr7gspfgsr/gsqbgs4YnLFxuICB9LFxuICBtbDoge1xuICAgIGRvd25sb2FkOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNJyxcbiAgICBkb3dubG9hZGluZzogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jSDgtJrgtYbgtK/gtY3gtK/gtYHgtKjgtY3gtKjgtYHigKYnLFxuICAgIHRyeWluZzogJ+C0tuC1jeC0sOC0ruC0v+C0leC1jeC0leC1geC0qOC1jeC0qOC1geKApicsXG4gICAgZG93bmxvYWRlZDogJ+C0quC1guC1vOC0pOC1jeC0pOC0v+C0r+C0vuC0r+C0vycsXG4gICAgZXJyb3I6ICfgtKrgtL/gtLbgtJXgtY0nLFxuICAgIGZhaWxlZDogJ+C0quC0sOC0vuC0nOC0r+C0quC1jeC0quC1huC0n+C1jeC0n+C1gScsXG4gICAgYXJpYURvd25sb2FkOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNJyxcbiAgICB0aXRsZVF1aWNrOiAn4LS14LWH4LSX4LSk4LWN4LSk4LS/4LW9IOC0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgY29tbWVudHM6ICfgtIXgtK3gtL/gtKrgtY3gtLDgtL7gtK/gtJngtY3gtJngtb4nLFxuICAgIGVkaXRlZDogJ+C0juC0oeC0v+C0seC1jeC0seC1geC0muC1huC0r+C1jeC0pOC1gScsXG4gIH0sXG4gIHVrOiB7XG4gICAgZG93bmxvYWQ6ICfQl9Cw0LLQsNC90YLQsNC20LjRgtC4JyxcbiAgICBkb3dubG9hZGluZzogJ9CX0LDQstCw0L3RgtCw0LbQtdC90L3Rj+KApicsXG4gICAgdHJ5aW5nOiAn0KHQv9GA0L7QsdCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JyxcbiAgICBlcnJvcjogJ9Cf0L7QvNC40LvQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10LLQtNCw0YfQsC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQqNCy0LjQtNC60LUg0LfQsNCy0LDQvdGC0LDQttC10L3QvdGPJyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDRltCyJyxcbiAgICBlZGl0ZWQ6ICfQl9C80ZbQvdC10L3QvicsXG4gIH0sXG4gIGVsOiB7XG4gICAgZG93bmxvYWQ6ICfOm86uz4jOtycsXG4gICAgZG93bmxvYWRpbmc6ICfOm86uz4jOt+KApicsXG4gICAgdHJ5aW5nOiAnzqDPgc6/z4PPgM6szrjOtc65zrHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfOn867zr/Ous67zrfPgc+OzrjOt866zrUnLFxuICAgIGVycm9yOiAnzqPPhs6szrvOvM6xJyxcbiAgICBmYWlsZWQ6ICfOkc+Azq3PhM+Fz4fOtS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ86bzq7PiM63JyxcbiAgICB0aXRsZVF1aWNrOiAnzpPPgc6uzrPOv8+BzrcgzrvOrs+IzrcnLFxuICAgIGNvbW1lbnRzOiAnz4PPh8+MzrvOuc6xJyxcbiAgICBlZGl0ZWQ6ICfOlc+AzrXOvs61z4HOs86xz4POvM6tzr3OvycsXG4gIH0sXG4gIGNzOiB7XG4gICAgZG93bmxvYWQ6ICdTdMOhaG5vdXQnLFxuICAgIGRvd25sb2FkaW5nOiAnU3RhaG92w6Fuw63igKYnLFxuICAgIHRyeWluZzogJ1prb3XFocOtbeKApicsXG4gICAgZG93bmxvYWRlZDogJ1N0YcW+ZW5vJyxcbiAgICBlcnJvcjogJ0NoeWJhJyxcbiAgICBmYWlsZWQ6ICdTZWxoYWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnU3TDoWhub3V0JyxcbiAgICB0aXRsZVF1aWNrOiAnUnljaGzDqSBzdGHFvmVuw60nLFxuICAgIGNvbW1lbnRzOiAna29tZW50w6HFmcWvJyxcbiAgICBlZGl0ZWQ6ICdVcHJhdmVubycsXG4gIH0sXG4gIHJvOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLFxuICAgIGRvd25sb2FkaW5nOiAnU2UgZGVzY2FyY8SD4oCmJyxcbiAgICB0cnlpbmc6ICdTZSDDrm5jZWFyY8SD4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmluYWxpemF0JyxcbiAgICBlcnJvcjogJ0Vyb2FyZScsXG4gICAgZmFpbGVkOiAnRciZdWF0LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY8SDcmNhyJtpJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY8SDcmNhcmUgcmFwaWTEgycsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlpJyxcbiAgICBlZGl0ZWQ6ICdNb2RpZmljYXQnLFxuICB9LFxuICBodToge1xuICAgIGRvd25sb2FkOiAnTGV0w7ZsdMOpcycsXG4gICAgZG93bmxvYWRpbmc6ICdMZXTDtmx0w6lz4oCmJyxcbiAgICB0cnlpbmc6ICdQcsOzYsOhbGtvesOhc+KApicsXG4gICAgZG93bmxvYWRlZDogJ0vDqXN6JyxcbiAgICBlcnJvcjogJ0hpYmEnLFxuICAgIGZhaWxlZDogJ1Npa2VydGVsZW4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMZXTDtmx0w6lzJyxcbiAgICB0aXRsZVF1aWNrOiAnR3lvcnMgbGV0w7ZsdMOpcycsXG4gICAgY29tbWVudHM6ICdtZWdqZWd5esOpcycsXG4gICAgZWRpdGVkOiAnU3plcmtlc3p0dmUnLFxuICB9LFxuICBzdjoge1xuICAgIGRvd25sb2FkOiAnTGFkZGEgbmVyJyxcbiAgICBkb3dubG9hZGluZzogJ0xhZGRhciBuZXLigKYnLFxuICAgIHRyeWluZzogJ0bDtnJzw7ZrZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLbGFydCcsXG4gICAgZXJyb3I6ICdGZWwnLFxuICAgIGZhaWxlZDogJ01pc3NseWNrYWRlcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhZGRhIG5lcicsXG4gICAgdGl0bGVRdWljazogJ1NuYWJiIG5lZGxhZGRuaW5nJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VyYWQnLFxuICB9LFxuICBkYToge1xuICAgIGRvd25sb2FkOiAnSGVudCcsXG4gICAgZG93bmxvYWRpbmc6ICdIZW50ZXLigKYnLFxuICAgIHRyeWluZzogJ1Byw7h2ZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdIZW50ZXQnLFxuICAgIGVycm9yOiAnRmVqbCcsXG4gICAgZmFpbGVkOiAnTWlzbHlra2VkZXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdIZW50JyxcbiAgICB0aXRsZVF1aWNrOiAnSHVydGlnIGRvd25sb2FkJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VyZXQnLFxuICB9LFxuICBmaToge1xuICAgIGRvd25sb2FkOiAnTGF0YWEnLFxuICAgIGRvd25sb2FkaW5nOiAnTGFkYXRhYW7igKYnLFxuICAgIHRyeWluZzogJ1lyaXRldMOkw6Ru4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnTGFkYXR0dScsXG4gICAgZXJyb3I6ICdWaXJoZScsXG4gICAgZmFpbGVkOiAnRXDDpG9ubmlzdHVpLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGF0YWEnLFxuICAgIHRpdGxlUXVpY2s6ICdQaWthbGF0YXVzJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnR0aWEnLFxuICAgIGVkaXRlZDogJ011b2thdHR1JyxcbiAgfSxcbiAgbm86IHtcbiAgICBkb3dubG9hZDogJ0xhc3QgbmVkJyxcbiAgICBkb3dubG9hZGluZzogJ0xhc3RlciBuZWTigKYnLFxuICAgIHRyeWluZzogJ1Byw7h2ZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdGZXJkaWcnLFxuICAgIGVycm9yOiAnRmVpbCcsXG4gICAgZmFpbGVkOiAnTWlzbHlrdGVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFzdCBuZWQnLFxuICAgIHRpdGxlUXVpY2s6ICdSYXNrIG5lZGxhc3RpbmcnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZXInLFxuICAgIGVkaXRlZDogJ1JlZGlnZXJ0JyxcbiAgfSxcbiAgaGU6IHtcbiAgICBkb3dubG9hZDogJ9eU15XXqNeT15QnLFxuICAgIGRvd25sb2FkaW5nOiAn157Xldeo15nXk+KApicsXG4gICAgdHJ5aW5nOiAn157XoNeh15TigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfXlNeV16nXnNedJyxcbiAgICBlcnJvcjogJ9ep15LXmdeQ15QnLFxuICAgIGZhaWxlZDogJ9eg15vXqdecJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfXlNeV16jXk9eUJyxcbiAgICB0aXRsZVF1aWNrOiAn15TXldeo15PXlCDXnteU15nXqNeUJyxcbiAgICBjb21tZW50czogJ9eq15LXldeR15XXqicsXG4gICAgZWRpdGVkOiAn16DXoteo15onLFxuICB9LFxuICBmYToge1xuICAgIGRvd25sb2FkOiAn2K/Yp9mG2YTZiNivJyxcbiAgICBkb3dubG9hZGluZzogJ9iv2LHYrdin2YQg2K/Yp9mG2YTZiNiv4oCmJyxcbiAgICB0cnlpbmc6ICfYqtmE2KfYtCDZhdis2K/Yr+KApicsXG4gICAgZG93bmxvYWRlZDogJ9in2YbYrNin2YUg2LTYrycsXG4gICAgZXJyb3I6ICfYrti32KcnLFxuICAgIGZhaWxlZDogJ9mG2KfZhdmI2YHZgicsXG4gICAgYXJpYURvd25sb2FkOiAn2K/Yp9mG2YTZiNivJyxcbiAgICB0aXRsZVF1aWNrOiAn2K/Yp9mG2YTZiNivINiz2LHbjNi5JyxcbiAgICBjb21tZW50czogJ9mG2LjYsScsXG4gICAgZWRpdGVkOiAn2YjbjNix2KfbjNi0INi02K/ZhycsXG4gIH0sXG4gIGZpbDoge1xuICAgIGRvd25sb2FkOiAnSS1kb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdOYWdkYS1kb3dubG9hZOKApicsXG4gICAgdHJ5aW5nOiAnU2ludXN1YnVrYW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUYXBvcyBuYScsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnTmFiaWdvLicsXG4gICAgYXJpYURvd25sb2FkOiAnSS1kb3dubG9hZCcsXG4gICAgdGl0bGVRdWljazogJ01hYmlsaXMgbmEgZG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAnbWdhIGtvbWVudG8nLFxuICAgIGVkaXRlZDogJ05hLWVkaXQnLFxuICB9LFxuICBtczoge1xuICAgIGRvd25sb2FkOiAnTXVhdCB0dXJ1bicsXG4gICAgZG93bmxvYWRpbmc6ICdNZW11YXQgdHVydW7igKYnLFxuICAgIHRyeWluZzogJ01lbmN1YmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTZWxlc2FpJyxcbiAgICBlcnJvcjogJ1JhbGF0JyxcbiAgICBmYWlsZWQ6ICdHYWdhbC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ011YXQgdHVydW4nLFxuICAgIHRpdGxlUXVpY2s6ICdNdWF0IHR1cnVuIHBhbnRhcycsXG4gICAgY29tbWVudHM6ICdrb21lbicsXG4gICAgZWRpdGVkOiAnRGllZGl0JyxcbiAgfSxcbiAgc3I6IHtcbiAgICBkb3dubG9hZDogJ9Cf0YDQtdGD0LfQvNC4JyxcbiAgICBkb3dubG9hZGluZzogJ9Cf0YDQtdGD0LfQuNC80LDRmtC14oCmJyxcbiAgICB0cnlpbmc6ICfQn9C+0LrRg9GI0LDQstCw0LzigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQl9Cw0LLRgNGI0LXQvdC+JyxcbiAgICBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsXG4gICAgYXJpYURvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXRg9C30LjQvNCw0ZrQtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLFxuICAgIGVkaXRlZDogJ9CY0LfQvNC10ZrQtdC90L4nLFxuICB9LFxuICBzazoge1xuICAgIGRvd25sb2FkOiAnU3RpYWhudcWlJyxcbiAgICBkb3dubG9hZGluZzogJ1PFpWFob3Zhbmll4oCmJyxcbiAgICB0cnlpbmc6ICdTa8O6xaFhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0hvdG92bycsXG4gICAgZXJyb3I6ICdDaHliYScsXG4gICAgZmFpbGVkOiAnWmx5aGFsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1N0aWFobnXFpScsXG4gICAgdGl0bGVRdWljazogJ1LDvWNobGUgc3RpYWhudXRpZScsXG4gICAgY29tbWVudHM6ICdrb21lbnTDoXJvdicsXG4gICAgZWRpdGVkOiAnVXByYXZlbsOpJyxcbiAgfSxcbiAgYmc6IHtcbiAgICBkb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JyxcbiAgICBkb3dubG9hZGluZzogJ9CY0LfRgtC10LPQu9GP0L3QteKApicsXG4gICAgdHJ5aW5nOiAn0J7Qv9C40YLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLFxuICAgIGVycm9yOiAn0JPRgNC10YjQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQmNC30YLQtdCz0LvQuCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YrRgNC30L4g0LjQt9GC0LXQs9C70Y/QvdC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQsCcsXG4gICAgZWRpdGVkOiAn0KDQtdC00LDQutGC0LjRgNCw0L3QvicsXG4gIH0sXG4gIGhyOiB7XG4gICAgZG93bmxvYWQ6ICdQcmV1em1pJyxcbiAgICBkb3dubG9hZGluZzogJ1ByZXV6aW1hbmpl4oCmJyxcbiAgICB0cnlpbmc6ICdQb2t1xaFhdmFt4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnR290b3ZvJyxcbiAgICBlcnJvcjogJ0dyZcWha2EnLFxuICAgIGZhaWxlZDogJ05ldXNwamVsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ByZXV6bWknLFxuICAgIHRpdGxlUXVpY2s6ICdCcnpvIHByZXV6aW1hbmplJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyYScsXG4gICAgZWRpdGVkOiAnVXJlxJFlbm8nLFxuICB9LFxuICBsdDoge1xuICAgIGRvd25sb2FkOiAnQXRzaXNpxbNzdGknLFxuICAgIGRvd25sb2FkaW5nOiAnU2l1bsSNaWFtYeKApicsXG4gICAgdHJ5aW5nOiAnQmFuZG9tYeKApicsXG4gICAgZG93bmxvYWRlZDogJ0JhaWd0YScsXG4gICAgZXJyb3I6ICdLbGFpZGEnLFxuICAgIGZhaWxlZDogJ05lcGF2eWtvLicsXG4gICAgYXJpYURvd25sb2FkOiAnQXRzaXNpxbNzdGknLFxuICAgIHRpdGxlUXVpY2s6ICdHcmVpdGFzIGF0c2lzaXVudGltYXMnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJhaScsXG4gICAgZWRpdGVkOiAnUmVkYWd1b3RhJyxcbiAgfSxcbiAgbHY6IHtcbiAgICBkb3dubG9hZDogJ0xlanVwaWVsxIFkxJN0JyxcbiAgICBkb3dubG9hZGluZzogJ0xlanVwaWVsxIFkxJPigKYnLFxuICAgIHRyeWluZzogJ03Ek8SjaW5h4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnUGFiZWlndHMnLFxuICAgIGVycm9yOiAnS8S8xatkYScsXG4gICAgZmFpbGVkOiAnTmVpemRldsSBcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xlanVwaWVsxIFkxJN0JyxcbiAgICB0aXRsZVF1aWNrOiAnxIB0csSBIGxlanVwaWVsxIFkZScsXG4gICAgY29tbWVudHM6ICdrb21lbnTEgXJpJyxcbiAgICBlZGl0ZWQ6ICdSZWRpxKPEk3RzJyxcbiAgfSxcbiAgZXQ6IHtcbiAgICBkb3dubG9hZDogJ0xhYWRpIGFsbGEnLFxuICAgIGRvd25sb2FkaW5nOiAnTGFhZGltaW5l4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9vdmlu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVmFsbWlzJyxcbiAgICBlcnJvcjogJ1ZpZ2EnLFxuICAgIGZhaWxlZDogJ0ViYcO1bm5lc3R1cy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhYWRpIGFsbGEnLFxuICAgIHRpdGxlUXVpY2s6ICdLaWlyZSBhbGxhbGFhZGltaW5lJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhYXJpJyxcbiAgICBlZGl0ZWQ6ICdNdXVkZXR1ZCcsXG4gIH0sXG4gIHNsOiB7XG4gICAgZG93bmxvYWQ6ICdQcmVub3MnLFxuICAgIGRvd25sb2FkaW5nOiAnUHJlbmHFoWFuamXigKYnLFxuICAgIHRyeWluZzogJ1Bvc2t1xaFhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0tvbsSNYW5vJyxcbiAgICBlcnJvcjogJ05hcGFrYScsXG4gICAgZmFpbGVkOiAnTmkgdXNwZWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnUHJlbm9zJyxcbiAgICB0aXRsZVF1aWNrOiAnSGl0ZXIgcHJlbm9zJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyamV2JyxcbiAgICBlZGl0ZWQ6ICdVcmVqZW5vJyxcbiAgfSxcbiAgY2E6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcnJlZ2EnLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FycmVnYW504oCmJyxcbiAgICB0cnlpbmc6ICdJbnRlbnRhbnTigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJyZWdhdCcsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnSGEgZmFsbGF0LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2PDoHJyZWdhIHLDoHBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpcycsXG4gICAgZWRpdGVkOiAnRWRpdGF0JyxcbiAgfSxcbiAgYWY6IHtcbiAgICBkb3dubG9hZDogJ0FmbGFhaScsXG4gICAgZG93bmxvYWRpbmc6ICdMYWFpIGFm4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9iZWVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhYXInLFxuICAgIGVycm9yOiAnRm91dCcsXG4gICAgZmFpbGVkOiAnTWlzbHVrLicsXG4gICAgYXJpYURvd25sb2FkOiAnQWZsYWFpJyxcbiAgICB0aXRsZVF1aWNrOiAnVmlubmlnZSBhZmxhYWknLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZScsXG4gICAgZWRpdGVkOiAnR2VyZWRpZ2VlcicsXG4gIH0sXG4gIGFtOiB7XG4gICAgZG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLFxuICAgIGRvd25sb2FkaW5nOiAn4Ymg4Yib4YuN4Yio4Yu1IOGIi+GLreKApicsXG4gICAgdHJ5aW5nOiAn4Ymg4YiY4Yie4Yqo4YitIOGIi+GLreKApicsXG4gICAgZG93bmxvYWRlZDogJ+GLiOGIreGLt+GIjScsXG4gICAgZXJyb3I6ICfhiLXhiIXhibDhibUnLFxuICAgIGZhaWxlZDogJ+GKoOGIjeGJsOGIs+GKq+GIneGNoicsXG4gICAgYXJpYURvd25sb2FkOiAn4Yqg4YuN4Yit4Yu1JyxcbiAgICB0aXRsZVF1aWNrOiAn4Y2I4Yyj4YqVIOGIm+GLjeGIqOGLtScsXG4gICAgY29tbWVudHM6ICfhiqDhiLXhibDhi6vhi6jhibbhib0nLFxuICAgIGVkaXRlZDogJ+GJsOGIteGJsOGKq+GKreGIj+GIjScsXG4gIH0sXG4gIGh5OiB7XG4gICAgZG93bmxvYWQ6ICfVhtWl1oDVotWl1bzVttWl1awnLFxuICAgIGRvd25sb2FkaW5nOiAn1YbVpdaA1aLVpdW81bbVuNaC1bTigKYnLFxuICAgIHRyeWluZzogJ9WT1bjWgNWx1bjWgtW0INWn4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn1LHVvtWh1oDVv9W+1aHVricsXG4gICAgZXJyb3I6ICfVjdWt1aHVrCcsXG4gICAgZmFpbGVkOiAn1YHVodWt1bjVstW+1aXWgTonLFxuICAgIGFyaWFEb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsXG4gICAgdGl0bGVRdWljazogJ9Sx1oDVodWjINW21aXWgNWi1aXVvNW21bjWgtW0JyxcbiAgICBjb21tZW50czogJ9W01aXVr9W21aHVotWh1bbVuNaC1anVtdW41oLVticsXG4gICAgZWRpdGVkOiAn1L3VtNWi1aHVo9aA1b7VpdWsINWnJyxcbiAgfSxcbiAgYXM6IHtcbiAgICBkb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEg4Ka54KeIIOCmhuCmm+Cnh+KApicsXG4gICAgdHJ5aW5nOiAn4Kaa4KeH4Ka34KeN4Kaf4Ka+IOCmleCnsOCmvyDgpobgppvgp4figKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgprjgpq7gp43gpqrgp4Lgp7Dgp43gpqMnLFxuICAgIGVycm9yOiAn4Kak4KeN4Kew4KeB4Kaf4Ka/JyxcbiAgICBmYWlsZWQ6ICfgpqzgpr/gpqvgprIg4Ka54oCZ4KayJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpqbgp43gp7Dgp4HgpqQg4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJyxcbiAgICBjb21tZW50czogJ+CmruCmqOCnjeCmpOCmrOCnjeCmrycsXG4gICAgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyxcbiAgfSxcbiAgYXo6IHtcbiAgICBkb3dubG9hZDogJ1nDvGtsyZknLFxuICAgIGRvd25sb2FkaW5nOiAnWcO8a2zJmW5pcuKApicsXG4gICAgdHJ5aW5nOiAnQ8mZaGQgZWRpbGly4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnQml0ZGknLFxuICAgIGVycm9yOiAnWMmZdGEnLFxuICAgIGZhaWxlZDogJ0FsxLFubWFkxLEuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdZw7xrbMmZJyxcbiAgICB0aXRsZVF1aWNrOiAnU8O8csmZdGxpIHnDvGtsyZltyZknLFxuICAgIGNvbW1lbnRzOiAnxZ/JmXJoJyxcbiAgICBlZGl0ZWQ6ICdEw7x6yZlsacWfIGVkaWxpYicsXG4gIH0sXG4gIGV1OiB7XG4gICAgZG93bmxvYWQ6ICdEZXNrYXJnYXR1JyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2thcmdhdHplbuKApicsXG4gICAgdHJ5aW5nOiAnU2FpYXR6ZW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdFZ2luZGEnLFxuICAgIGVycm9yOiAnRXJyb3JlYScsXG4gICAgZmFpbGVkOiAnSHV0cyBlZ2luIGR1LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVza2FyZ2F0dScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2thcmdhIGF6a2FycmEnLFxuICAgIGNvbW1lbnRzOiAnaXJ1emtpbicsXG4gICAgZWRpdGVkOiAnRWRpdGF0dWEnLFxuICB9LFxuICBteToge1xuICAgIGRvd25sb2FkOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JyxcbiAgICBkb3dubG9hZGluZzogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuiDhgJzhgK/hgJXhgLrhgJThgLHigKYnLFxuICAgIHRyeWluZzogJ+GAgOGAvOGAreGAr+GAuOGAheGArOGAuOGAlOGAseKApicsXG4gICAgZG93bmxvYWRlZDogJ+GAleGAvOGAruGAuOGAleGAq+GAleGAvOGAricsXG4gICAgZXJyb3I6ICfhgKHhgJnhgL7hgKzhgLgnLFxuICAgIGZhaWxlZDogJ+GAmeGAoeGAseGArOGAhOGAuuGAmeGAvOGAhOGAuuGAleGAq+GBiycsXG4gICAgYXJpYURvd25sb2FkOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JyxcbiAgICB0aXRsZVF1aWNrOiAn4YCh4YCZ4YC84YCU4YC6IOGAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgY29tbWVudHM6ICfhgJnhgL7hgJDhgLrhgIHhgLvhgIDhgLrhgJnhgLvhgKzhgLgnLFxuICAgIGVkaXRlZDogJ+GAleGAvOGAhOGAuuGAhuGAhOGAuuGAleGAvOGAruGAuCcsXG4gIH0sXG4gIGdsOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLFxuICAgIHRyeWluZzogJ1RlbnRhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsXG4gICAgZXJyb3I6ICdFcnJvJyxcbiAgICBmYWlsZWQ6ICdGYWxsb3UuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAga2E6IHtcbiAgICBkb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsXG4gICAgZG93bmxvYWRpbmc6ICfhg5jhg6zhg5Thg6Dhg5Thg5Hhg5DigKYnLFxuICAgIHRyeWluZzogJ+GDm+GDquGDk+GDlOGDmuGDneGDkeGDkOKApicsXG4gICAgZG93bmxvYWRlZDogJ+GDk+GDkOGDoeGDoOGDo+GDmuGDk+GDkCcsXG4gICAgZXJyb3I6ICfhg6jhg5Thg6rhg5Phg53hg5vhg5AnLFxuICAgIGZhaWxlZDogJ+GDleGDlOGDoCDhg5vhg53hg67hg5Thg6Dhg67hg5Phg5AuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLFxuICAgIHRpdGxlUXVpY2s6ICfhg6Hhg6zhg6Dhg5Dhg6Thg5gg4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJyxcbiAgICBjb21tZW50czogJ+GDmeGDneGDm+GDlOGDnOGDouGDkOGDoOGDmCcsXG4gICAgZWRpdGVkOiAn4YOg4YOU4YOT4YOQ4YOl4YOi4YOY4YOg4YOU4YOR4YOj4YOa4YOY4YOQJyxcbiAgfSxcbiAgaXM6IHtcbiAgICBkb3dubG9hZDogJ1PDpmtqYScsXG4gICAgZG93bmxvYWRpbmc6ICdTw6ZraXLigKYnLFxuICAgIHRyeWluZzogJ1JleW5p4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU8OzdHQnLFxuICAgIGVycm9yOiAnVmlsbGEnLFxuICAgIGZhaWxlZDogJ01pc3TDs2tzdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1PDpmtqYScsXG4gICAgdGl0bGVRdWljazogJ0Zsw710aW5pw7B1cmhhbCcsXG4gICAgY29tbWVudHM6ICd1bW3DpmxpJyxcbiAgICBlZGl0ZWQ6ICdCcmV5dHQnLFxuICB9LFxuICBnYToge1xuICAgIGRvd25sb2FkOiAnw41vc2zDs2TDoWlsJyxcbiAgICBkb3dubG9hZGluZzogJ0FnIMOtb3Nsw7Nkw6FpbOKApicsXG4gICAgdHJ5aW5nOiAnQWcgaWFycmFpZGjigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfDjW9zbMOzZMOhaWx0ZScsXG4gICAgZXJyb3I6ICdFYXJyw6FpZCcsXG4gICAgZmFpbGVkOiAnVGhlaXAgYWlyLicsXG4gICAgYXJpYURvd25sb2FkOiAnw41vc2zDs2TDoWlsJyxcbiAgICB0aXRsZVF1aWNrOiAnw41vc2zDs2TDoWlsIHRhcGEnLFxuICAgIGNvbW1lbnRzOiAndHLDoWNodCcsXG4gICAgZWRpdGVkOiAnRWFncmFpdGhlJyxcbiAgfSxcbiAga2s6IHtcbiAgICBkb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLFxuICAgIGRvd25sb2FkaW5nOiAn0JbSr9C60YLQtdC70YPQtNC14oCmJyxcbiAgICB0cnlpbmc6ICfTmNGA0LXQutC10YLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQkNGP0pvRgtCw0LvQtNGLJyxcbiAgICBlcnJvcjogJ9Ka0LDRgtC1JyxcbiAgICBmYWlsZWQ6ICfQodOZ0YLRgdGW0LcuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQltKv0LrRgtC10L8g0LDQu9GDJyxcbiAgICB0aXRsZVF1aWNrOiAn0JbRi9C70LTQsNC8INC20q/QutGC0LXRgycsXG4gICAgY29tbWVudHM6ICfQv9GW0LrRltGAJyxcbiAgICBlZGl0ZWQ6ICfTqNC30LPQtdGA0YLRltC70LTRlicsXG4gIH0sXG4gIGttOiB7XG4gICAgZG93bmxvYWQ6ICfhnpHhnrbhnonhnpnhnoAnLFxuICAgIGRvd25sb2FkaW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6R4Z624Z6J4Z6Z4Z6A4oCmJyxcbiAgICB0cnlpbmc6ICfhnoDhn4bhnpbhnrvhnoThnpbhn5LhnpnhnrbhnpnhnrbhnpjigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhnpThnrbhnpPhnpThnonhn5LhnoXhnpThn4snLFxuICAgIGVycm9yOiAn4Z6A4Z+G4Z6g4Z674Z6fJyxcbiAgICBmYWlsZWQ6ICfhnpThnprhnrbhnofhn5DhnpknLFxuICAgIGFyaWFEb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsXG4gICAgdGl0bGVRdWljazogJ+GekeGetuGeieGemeGegOGem+Gev+GekycsXG4gICAgY29tbWVudHM6ICfhnpjhno/hnrcnLFxuICAgIGVkaXRlZDogJ+GelOGetuGek+GegOGfguGen+GemOGfkuGemuGeveGemycsXG4gIH0sXG4gIGxvOiB7XG4gICAgZG93bmxvYWQ6ICfgupTgurLguqfgu4LguqvguqXgupQnLFxuICAgIGRvd25sb2FkaW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4oCmJyxcbiAgICB0cnlpbmc6ICfguoHgurPguqXgurHguofgup7gurDguo3gurLguo3gurLguqHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfguqrgurPgu4DguqXgurHgupQnLFxuICAgIGVycm9yOiAn4Lqc4Lq04LqU4Lqe4Lqy4LqUJyxcbiAgICBmYWlsZWQ6ICfguqXgurvgu4nguqHgu4DguqvguqXguqcnLFxuICAgIGFyaWFEb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsXG4gICAgdGl0bGVRdWljazogJ+C6lOC6suC6p+C7guC6q+C6peC6lOC6lOC7iOC6p+C6mScsXG4gICAgY29tbWVudHM6ICfguoTgurPgu4DguqvgurHgupknLFxuICAgIGVkaXRlZDogJ+C7geC6geC7ieC7hOC6guC7geC6peC7ieC6pycsXG4gIH0sXG4gIG1rOiB7XG4gICAgZG93bmxvYWQ6ICfQn9GA0LXQt9C10LzQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQn9GA0LXQt9C10LzQsNGa0LXigKYnLFxuICAgIHRyeWluZzogJ9Ch0LUg0L7QsdC40LTRg9Cy0LDQvOKApicsXG4gICAgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsXG4gICAgZXJyb3I6ICfQk9GA0LXRiNC60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10LfQtdC80LDRmtC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQuCcsXG4gICAgZWRpdGVkOiAn0JjQt9C80LXQvdC10YLQvicsXG4gIH0sXG4gIG1uOiB7XG4gICAgZG93bmxvYWQ6ICfQotCw0YLQsNGFJyxcbiAgICBkb3dubG9hZGluZzogJ9Ci0LDRgtCw0LYg0LHQsNC50L3QsOKApicsXG4gICAgdHJ5aW5nOiAn0J7RgNC70LTQvtC2INCx0LDQudC90LDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQotCw0YLRgdCw0L0nLFxuICAgIGVycm9yOiAn0JDQu9C00LDQsCcsXG4gICAgZmFpbGVkOiAn0JDQvNC20LjQu9GC0LPSr9C5LicsXG4gICAgYXJpYURvd25sb2FkOiAn0KLQsNGC0LDRhScsXG4gICAgdGl0bGVRdWljazogJ9Cl0YPRgNC00LDQvSDRgtCw0YLQsNGFJyxcbiAgICBjb21tZW50czogJ9GB0Y3RgtCz0Y3Qs9C00Y3QuycsXG4gICAgZWRpdGVkOiAn0JfQsNGB0YHQsNC9JyxcbiAgfSxcbiAgbmU6IHtcbiAgICBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWB4KSB4KSm4KWI4oCmJyxcbiAgICB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpL7gpLgg4KSX4KSw4KWN4KSm4KWI4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KS+IOCkreCkr+CliycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLFxuICAgIGZhaWxlZDogJ+CkheCkuOCkq+CksiDgpK3gpK/gpYsnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgdGl0bGVRdWljazogJ+Ckm+Ckv+Ckn+CliyDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KWA4KS54KSw4KWCJyxcbiAgICBlZGl0ZWQ6ICfgpLjgpK7gpY3gpKrgpL7gpKbgpL/gpKQnLFxuICB9LFxuICBvcjoge1xuICAgIGRvd25sb2FkOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICBkb3dubG9hZGluZzogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjSDgrLngrYfgrIngrJvgrL/igKYnLFxuICAgIHRyeWluZzogJ+CsmuCth+Cst+CtjeCsn+CsviDgrJXgrLDgrYHgrJvgrL/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgrLjgrK7grY3grKrgrYLgrLDgrY3grKPgrY3grKMnLFxuICAgIGVycm9yOiAn4Kyk4K2N4Kyw4K2B4Kyf4Ky/JyxcbiAgICBmYWlsZWQ6ICfgrKzgrL/grKvgrLMg4Ky54K2H4Kyy4Ky+JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLFxuICAgIHRpdGxlUXVpY2s6ICfgrLbgrYDgrJjgrY3grLAg4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICBjb21tZW50czogJ+CsruCsqOCtjeCspOCsrOCtjeCtnycsXG4gICAgZWRpdGVkOiAn4Ky44Kyu4K2N4Kyq4Ky+4Kym4Ky/4KykJyxcbiAgfSxcbiAgc2k6IHtcbiAgICBkb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsXG4gICAgZG93bmxvYWRpbmc6ICfgtrbgt4/gtpzgtq0g4LeA4LeZ4La44LeS4Lax4LeK4oCmJyxcbiAgICB0cnlpbmc6ICfgtovgtq3gt4rgt4Pgt4/gt4Qg4Laa4La74La44LeS4Lax4LeK4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LaF4LeA4LeD4Lax4LeKJyxcbiAgICBlcnJvcjogJ+C2r+C3neC3guC2uuC2muC3kicsXG4gICAgZmFpbGVkOiAn4LaF4LeD4LeP4La74LeK4Lau4Laa4La64LeSJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgtrbgt4/gtpzgtrHgt4rgtrEnLFxuICAgIHRpdGxlUXVpY2s6ICfgtongtprgt4rgtrjgtrHgt4og4La24LeP4Lac4LatIOC2muC3kuC2u+C3k+C2uCcsXG4gICAgY29tbWVudHM6ICfgtoXgtq/gt4Tgt4Pgt4onLFxuICAgIGVkaXRlZDogJ+C3g+C2guC3g+C3iuC2muC2u+C2q+C2uicsXG4gIH0sXG4gIHN3OiB7XG4gICAgZG93bmxvYWQ6ICdQYWt1YScsXG4gICAgZG93bmxvYWRpbmc6ICdJbmFwYWt1YeKApicsXG4gICAgdHJ5aW5nOiAnSW5hamFyaWJ14oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSW1la2FtaWxpa2EnLFxuICAgIGVycm9yOiAnSGl0aWxhZnUnLFxuICAgIGZhaWxlZDogJ0ltZXNoaW5kd2EuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQYWt1YScsXG4gICAgdGl0bGVRdWljazogJ1Bha3VhIGhhcmFrYScsXG4gICAgY29tbWVudHM6ICdtYW9uaScsXG4gICAgZWRpdGVkOiAnSW1laGFyaXJpd2EnLFxuICB9LFxuICB1ejoge1xuICAgIGRvd25sb2FkOiAnWXVrbGFzaCcsXG4gICAgZG93bmxvYWRpbmc6ICdZdWtsYW5tb3FkYeKApicsXG4gICAgdHJ5aW5nOiAnVXJpbmlsbW9xZGHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUYXl5b3InLFxuICAgIGVycm9yOiAnWGF0bycsXG4gICAgZmFpbGVkOiAnTXV2YWZmYXFpeWF0c2l6LicsXG4gICAgYXJpYURvd25sb2FkOiAnWXVrbGFzaCcsXG4gICAgdGl0bGVRdWljazogJ1RleiB5dWtsYXNoJyxcbiAgICBjb21tZW50czogJ3NoYXJobGFyJyxcbiAgICBlZGl0ZWQ6ICdUYWhyaXJsYW5nYW4nLFxuICB9LFxuICBjeToge1xuICAgIGRvd25sb2FkOiAnTGF3cmx3eXRobycsXG4gICAgZG93bmxvYWRpbmc6ICdZbiBsYXdybHd5dGhv4oCmJyxcbiAgICB0cnlpbmc6ICdZbiBjZWlzaW/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdXZWRpIGdvcmZmZW4nLFxuICAgIGVycm9yOiAnR3dhbGwnLFxuICAgIGZhaWxlZDogJ01ldGhvZGQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYXdybHd5dGhvJyxcbiAgICB0aXRsZVF1aWNrOiAnTGF3cmx3eXRobyBjeWZseW0nLFxuICAgIGNvbW1lbnRzOiAnc3lsd2FkYXUnLFxuICAgIGVkaXRlZDogJ0dvbHlnd3lkJyxcbiAgfSxcbiAgenU6IHtcbiAgICBkb3dubG9hZDogJ0xhbmRhJyxcbiAgICBkb3dubG9hZGluZzogJ0l5YWxhbmR3YeKApicsXG4gICAgdHJ5aW5nOiAnSXlhemFtYeKApicsXG4gICAgZG93bmxvYWRlZDogJ0lsYW5kxKt3ZScsXG4gICAgZXJyb3I6ICdJcGh1dGhhJyxcbiAgICBmYWlsZWQ6ICdJaGx1bGVraWxlLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFuZGEnLFxuICAgIHRpdGxlUXVpY2s6ICdVa3VsYW5kYSBva3VzaGVzaGF5bycsXG4gICAgY29tbWVudHM6ICdhbWF6d2FuYScsXG4gICAgZWRpdGVkOiAnS3VobGVsaXdlJyxcbiAgfSxcbiAgc3E6IHtcbiAgICBkb3dubG9hZDogJ1Noa2Fya28nLFxuICAgIGRvd25sb2FkaW5nOiAnRHVrZSBzaGthcmt1YXLigKYnLFxuICAgIHRyeWluZzogJ0R1a2UgcHJvdnVhcuKApicsXG4gICAgZG93bmxvYWRlZDogJ1DDq3JmdW5kb2knLFxuICAgIGVycm9yOiAnR2FiaW0nLFxuICAgIGZhaWxlZDogJ0TDq3NodG9pLicsXG4gICAgYXJpYURvd25sb2FkOiAnU2hrYXJrbycsXG4gICAgdGl0bGVRdWljazogJ1Noa2Fya2ltIGkgc2hwZWp0w6snLFxuICAgIGNvbW1lbnRzOiAna29tZW50ZScsXG4gICAgZWRpdGVkOiAnRSByZWRha3R1YXInLFxuICB9LFxufTtcblxuZXhwb3J0IHR5cGUgTGFuZ0tleSA9IGtleW9mIHR5cGVvZiBUUkFOU0xBVElPTlMuZW47XG5cbmV4cG9ydCBmdW5jdGlvbiB0KGtleTogTGFuZ0tleSk6IHN0cmluZyB7XG4gIHRyeSB7XG4gICAgaWYgKCFrZXkgfHwgdHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiAnLi4uJztcbiAgICB9XG5cbiAgICBsZXQgcmF3TGFuZyA9ICdlbic7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmXG4gICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZ1xuICAgICkge1xuICAgICAgcmF3TGFuZyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLmxhbmd1YWdlKSB7XG4gICAgICByYXdMYW5nID0gbmF2aWdhdG9yLmxhbmd1YWdlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRMYW5nID0gcmF3TGFuZ1xuICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgIC5zcGxpdCgnOycpWzBdXG4gICAgICAudHJpbSgpXG4gICAgICAucmVwbGFjZSgnXycsICctJyk7XG4gICAgY29uc3QgYmFzZUxhbmcgPSBub3JtYWxpemVkTGFuZy5zcGxpdCgnLScpWzBdO1xuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ11ba2V5XSA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV07XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TW2Jhc2VMYW5nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ11ba2V5XSA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV07XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TWydlbiddICYmXG4gICAgICB0eXBlb2YgVFJBTlNMQVRJT05TWydlbiddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV07XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleTtcbiAgfSBjYXRjaCB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XSB8fCBrZXk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gU3RyaW5nKGtleSB8fCAnRG93bmxvYWQnKTtcbiAgICB9XG4gIH1cbn1cbiIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzXG5cbi8qKlxuICogVEhFTUUgREVURUNUT1JcbiAqXG4gKiBHb2FsOiBcIklzIHRoZSBjb250ZW50IEknbSBkcmF3aW5nIG9uIHZpc3VhbGx5IGRhcmsgb3IgbGlnaHQ/XCJcbiAqIEluc3RlYWQgb2YgZ3Vlc3NpbmcgZnJvbSA8Ym9keT4sIHdlOlxuICogIC0gUmVzcGVjdCBEYXJrIFJlYWRlciBpZiBwcmVzZW50XG4gKiAgLSBMb29rIGZvciBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3Nlc1xuICogIC0gTWVhc3VyZSB0aGUgZWZmZWN0aXZlIGJhY2tncm91bmQgY29sb3Igb2YgYSAqY29udGVudCogZWxlbWVudFxuICogICAgKGUuZy4gR29vZ2xlIENsYXNzcm9vbSBzdHJlYW0gY2FyZHMpXG4gKi9cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHBhZ2UgKmNvbnRlbnQgYXJlYSogaXMgdmlzdWFsbHkgZGFyay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGFnZURhcmsoKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMS4gRmFzdCBwYXRoOiBEYXJrIFJlYWRlciBhdHRyaWJ1dGVcbiAgY29uc3QgZHJTY2hlbWUgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWRhcmtyZWFkZXItc2NoZW1lJyk7XG4gIGlmIChkclNjaGVtZSA9PT0gJ2RhcmsnKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGRyU2NoZW1lID09PSAnbGlnaHQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMi4gSGV1cmlzdGljOiBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3NlcyBvbiA8aHRtbD4gLyA8Ym9keT5cbiAgLy8gKGNvdmVycyBzb21lIGZyYW1ld29ya3MgYW5kIGV4dGVuc2lvbnMpXG4gIGNvbnN0IGRhcmtUb2tlbnMgPSBbJ2RhcmsnLCAnZGFyay10aGVtZScsICd0aGVtZS1kYXJrJywgJ25pZ2h0JywgJ2dtMy1kYXJrLXRoZW1lJ107XG4gIGNvbnN0IGh0bWxDbGFzcyA9IChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xhc3NOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBib2R5Q2xhc3MgPSAoZG9jdW1lbnQuYm9keS5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChkYXJrVG9rZW5zLnNvbWUodG9rZW4gPT4gaHRtbENsYXNzLmluY2x1ZGVzKHRva2VuKSB8fCBib2R5Q2xhc3MuaW5jbHVkZXModG9rZW4pKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gMy4gUHJvYmUgYSAqY29udGVudCogZWxlbWVudCwgbm90IHRoZSB3aG9sZSBwYWdlIGJhY2tncm91bmQuXG4gIC8vICAgIEZvciBDbGFzc3Jvb20sIHBvc3RzIGFyZSB0aGUgbWFpbiBzdXJmYWNlIHdlIGRyYXcgb24uXG4gIGNvbnN0IHByb2JlRWwgPVxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nKSB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdbcm9sZT1cIm1haW5cIl0nKSB8fFxuICAgIGRvY3VtZW50LmJvZHk7XG5cbiAgY29uc3QgYmdDb2xvciA9IGdldEVmZmVjdGl2ZUJhY2tncm91bmRDb2xvcihwcm9iZUVsKTtcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IHBhcnNlQnJpZ2h0bmVzcyhiZ0NvbG9yKTtcblxuICAvLyA0LiBEZWNpZGUgdGhyZXNob2xkLlxuICAvLyAgICAxMjggaXMgXCI1MCUgZ3JheVwiLCBidXQgdGhhdCBmbGlwcyB0b28gZWFybHkgb24gc2xpZ2h0bHkgZ3JheSBVSXMuXG4gIC8vICAgIFVzZSBhIHN0cmljdGVyIHRocmVzaG9sZCBzbyB3ZSBvbmx5IHRyZWF0IGNsZWFybHkgZGFyayBVSXMgYXMgZGFyay5cbiAgcmV0dXJuIGJyaWdodG5lc3MgPCAxMDU7XG59XG5cbi8qKlxuICogV2Fsa3MgdXAgdGhlIERPTSBmcm9tIGEgZ2l2ZW4gZWxlbWVudCB1bnRpbCBpdCBmaW5kcyBhIG5vbi10cmFuc3BhcmVudCBiYWNrZ3JvdW5kIGNvbG9yLlxuICogRmFsbHMgYmFjayB0byA8aHRtbD4gYW5kIGZpbmFsbHkgdG8gcHVyZSB3aGl0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHN0YXJ0OiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIGxldCBlbDogSFRNTEVsZW1lbnQgfCBudWxsID0gc3RhcnQ7XG5cbiAgY29uc3QgaXNUcmFuc3BhcmVudCA9IChjOiBzdHJpbmcgfCBudWxsKSA9PlxuICAgICFjIHx8IGMgPT09ICd0cmFuc3BhcmVudCcgfHwgYyA9PT0gJ3JnYmEoMCwgMCwgMCwgMCknO1xuXG4gIHdoaWxlIChlbCkge1xuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIGNvbnN0IGJnID0gc3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICAgIGlmICghaXNUcmFuc3BhcmVudChiZykpIHJldHVybiBiZztcbiAgICBlbCA9IGVsLnBhcmVudEVsZW1lbnQ7XG4gIH1cblxuICAvLyBUcnkgPGh0bWw+IGFzIGEgbGFzdCByZWFsIGVsZW1lbnRcbiAgY29uc3QgaHRtbFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KTtcbiAgY29uc3QgaHRtbEJnID0gaHRtbFN0eWxlLmJhY2tncm91bmRDb2xvcjtcbiAgaWYgKCFpc1RyYW5zcGFyZW50KGh0bWxCZykpIHJldHVybiBodG1sQmc7XG5cbiAgLy8gQWJzb2x1dGUgZmFsbGJhY2s6IGFzc3VtZSB3aGl0ZVxuICByZXR1cm4gJ3JnYigyNTUsIDI1NSwgMjU1KSc7XG59XG5cbi8qKlxuICogSGVscGVyOiBDYWxjdWxhdGVzIGJyaWdodG5lc3MgKDAtMjU1KSBmcm9tIGFuIFJHQihBKSBzdHJpbmcuXG4gKiBVc2VzIHRoZSBIU1AgY29sb3IgZm9ybXVsYTogc3FydCgwLjI5OSpSXjIgKyAwLjU4NypHXjIgKyAwLjExNCpCXjIpXG4gKi9cbmZ1bmN0aW9uIHBhcnNlQnJpZ2h0bmVzcyhyZ2JTdHJpbmc6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IG1hdGNoID0gcmdiU3RyaW5nLm1hdGNoKC8oXFxkKyksXFxzKihcXGQrKSxcXHMqKFxcZCspLyk7XG4gIGlmICghbWF0Y2gpIHtcbiAgICAvLyBJZiB3ZSBjYW4ndCBwYXJzZSBpdCwgYXNzdW1lIGJyaWdodCBzbyB3ZSBkb24ndCBhY2NpZGVudGFsbHkgZmxpcCB0byBkYXJrIG1vZGUuXG4gICAgcmV0dXJuIDI1NTtcbiAgfVxuXG4gIGNvbnN0IHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICBjb25zdCBnID0gcGFyc2VJbnQobWF0Y2hbMl0sIDEwKTtcbiAgY29uc3QgYiA9IHBhcnNlSW50KG1hdGNoWzNdLCAxMCk7XG5cbiAgLy8gSFNQIGVxdWF0aW9uIGlzIHBlcmNlaXZlZCBicmlnaHRuZXNzXG4gIGNvbnN0IGJyaWdodG5lc3MgPSBNYXRoLnNxcnQoXG4gICAgMC4yOTkgKiAociAqIHIpICtcbiAgICAwLjU4NyAqIChnICogZykgK1xuICAgIDAuMTE0ICogKGIgKiBiKVxuICApO1xuXG4gIHJldHVybiBicmlnaHRuZXNzO1xufVxuXG4vKipcbiAqIFdhdGNoZXI6IE5vdGlmaWVzIHlvdSB3aGVuIHRoZSB0aGVtZSBsaWtlbHkgY2hhbmdlZC5cbiAqXG4gKiBZb3UgY2FuIHVzZSB0aGlzIGlmIHlvdSBldmVyIHdhbnQgdG8gZHluYW1pY2FsbHkgcmUtc3R5bGUgdGhpbmdzXG4gKiB3aGVuIHRoZSB1c2VyIC8gZXh0ZW5zaW9uIHRvZ2dsZXMgdGhlbWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YXRjaFRoZW1lQ2hhbmdlcyhjYWxsYmFjazogKGlzRGFyazogYm9vbGVhbikgPT4gdm9pZCk6IE11dGF0aW9uT2JzZXJ2ZXIge1xuICBjb25zdCBoYW5kbGVyID0gKCkgPT4ge1xuICAgIGNhbGxiYWNrKGlzUGFnZURhcmsoKSk7XG4gIH07XG5cbiAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihoYW5kbGVyKTtcblxuICAvLyBXYXRjaCBmb3IgYXR0cmlidXRlL2NsYXNzIGNoYW5nZXMgb24gPGh0bWw+IGFuZCA8Ym9keT5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHtcbiAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLWRhcmtyZWFkZXItc2NoZW1lJywgJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIC8vIEFsc28gbGlzdGVuIHRvIHN5c3RlbSB0aGVtZSBjaGFuZ2VzIGFzIGEgYmFja3VwIHNpZ25hbFxuICBpZiAodHlwZW9mIHdpbmRvdy5tYXRjaE1lZGlhID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3QgbXEgPSB3aW5kb3cubWF0Y2hNZWRpYSgnKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKScpO1xuICAgIGlmIChtcSkge1xuICAgICAgY29uc3QgbXFMaXN0ZW5lciA9ICgpID0+IGhhbmRsZXIoKTtcbiAgICAgIC8vIE1vZGVybiBicm93c2Vyc1xuICAgICAgaWYgKChtcSBhcyBhbnkpLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgbXEuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgbXFMaXN0ZW5lcik7XG4gICAgICB9IGVsc2UgaWYgKChtcSBhcyBhbnkpLmFkZExpc3RlbmVyKSB7XG4gICAgICAgIC8vIExlZ2FjeSBBUElcbiAgICAgICAgKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIobXFMaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gSW5pdGlhbCBjYWxsIHNvIHRoZSBjb25zdW1lciBjYW4gc3luYyBpbW1lZGlhdGVseVxuICBoYW5kbGVyKCk7XG5cbiAgcmV0dXJuIG9ic2VydmVyO1xufVxuIiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbnRlbnQvaW5kZXgudHNcblxuY29uc3QgQ0xBU1NST09NX1VSTF9QQVRURVJOID0gL15odHRwczpcXC9cXC9jbGFzc3Jvb21cXC5nb29nbGVcXC5jb21cXC8vO1xuXG5pbXBvcnQge1xuICBET1dOTE9BRF9JQ09OX1NWR19VUkwsXG4gIFNVQ0NFU1NfSUNPTl9TVkdfVVJMLFxuICBFUlJPUl9JQ09OX1NWR19VUkwsXG59IGZyb20gJy4vaWNvbnMnO1xuXG5pbXBvcnQgeyBpbmplY3RTdHlsZXMgfSBmcm9tICcuL3N0eWxlcyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcbmltcG9ydCB7IGlzUGFnZURhcmsgfSBmcm9tICcuL3RoZW1lJztcblxuY29uc3QgSU5KRUNURURfQVRUUiA9ICdkYXRhLWNxZC1pbmplY3RlZCc7XG5jb25zdCBQUk9DRVNTRURfQVRUUiA9ICdkYXRhLWNxZC1wcm9jZXNzZWQnO1xuY29uc3QgUkVTQ0FOX0lOVEVSVkFMX01TID0gMjAwMDsgLy8gU3BlZWQgdXAgc2xpZ2h0bHlcbmNvbnN0IFJFU0NBTl9ERUJPVU5DRV9NUyA9IDIwMDtcbmNvbnN0IExPQURJTkdfTUlOX01TID0gNjAwO1xuY29uc3QgRkVFREJBQ0tfU1VDQ0VTU19NUyA9IDMwMDA7XG5jb25zdCBGRUVEQkFDS19FUlJPUl9NUyA9IDQwMDA7XG5cbmNvbnN0IERSSVZFX0FOQ0hPUl9TRUxFQ1RPUiA9XG4gICdhW2hyZWYqPVwiaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tXCJdLCBhW2hyZWYqPVwiLy9kcml2ZS5nb29nbGUuY29tXCJdLCBhW2hyZWYqPVwiY2xhc3Nyb29tLmdvb2dsZS5jb20vZHJpdmVcIl0nO1xuXG5jb25zdCBBVFRBQ0hNRU5UX0NPTlRBSU5FUl9TRUxFQ1RPUiA9IFtcbiAgJy5LbFJYZGYnLFxuICAnLnozdlJjYycsXG4gICcuVmZQcGtkLWFQUDc4ZScsXG4gICdbZGF0YS1kcml2ZS1pZF0nLFxuICAnW2RhdGEtaWRdW2RhdGEtaXRlbS1pZF0nLFxuXS5qb2luKCcsICcpO1xuXG5jb25zdCBEUklWRV9VUkxfUEFUVEVSTlM6IFJlZ0V4cFtdID0gW1xuICAvaHR0cHM6XFwvXFwvZHJpdmVcXC5nb29nbGVcXC5jb21cXC9maWxlXFwvZFxcLy8sXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL29wZW5cXD8vLFxuICAvaHR0cHM6XFwvXFwvZHJpdmVcXC5nb29nbGVcXC5jb21cXC91Y1xcPy8sXG4gIC9odHRwczpcXC9cXC9jbGFzc3Jvb21cXC5nb29nbGVcXC5jb21cXC9kcml2ZVxcLy8sXG5dO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogR2xvYmFsIFN0YXRlXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG50eXBlIFF1ZXJ5Um9vdCA9IERvY3VtZW50IHwgSFRNTEVsZW1lbnQgfCBEb2N1bWVudEZyYWdtZW50O1xuXG5sZXQgc2NhblRpbWVvdXRJZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5sZXQgb2JzZXJ2ZXI6IE11dGF0aW9uT2JzZXJ2ZXIgfCBudWxsID0gbnVsbDtcblxudHlwZSBCdXR0b25TdGF0ZSA9ICdpZGxlJyB8ICdsb2FkaW5nJyB8ICdzdWNjZXNzJyB8ICdlcnJvcicgfCAndHJ5aW5nJztcblxudHlwZSBGaWxlTWV0YSA9IHtcbiAgbmFtZT86IHN0cmluZztcbiAgZXh0Pzogc3RyaW5nO1xuICBraW5kPzogc3RyaW5nO1xufTtcblxudHlwZSBQZW5kaW5nQnV0dG9uID0ge1xuICBidXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICByZXF1ZXN0SWQ6IHN0cmluZztcbiAgZmlsZU1ldGE/OiBGaWxlTWV0YTtcbiAgc3RhcnRlZEF0OiBudW1iZXI7XG59O1xuXG5sZXQgbmV4dFJlcXVlc3RTZXEgPSAxO1xuY29uc3QgcGVuZGluZ0J1dHRvbnMgPSBuZXcgTWFwPHN0cmluZywgUGVuZGluZ0J1dHRvbj4oKTtcblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEVudmlyb25tZW50IC8gUGFnZSBDaGVja3NcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGlzR29vZ2xlQ2xhc3Nyb29tKCk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIGxvY2F0aW9uID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICBpZiAobG9jYXRpb24uaG9zdG5hbWUgIT09ICdjbGFzc3Jvb20uZ29vZ2xlLmNvbScpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIENMQVNTUk9PTV9VUkxfUEFUVEVSTi50ZXN0KGxvY2F0aW9uLmhyZWYpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogU2Nhbm5pbmcgLyBPYnNlcnZlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHNjaGVkdWxlU2NhbigpOiB2b2lkIHtcbiAgaWYgKHNjYW5UaW1lb3V0SWQgIT09IG51bGwpIHtcbiAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHNjYW5UaW1lb3V0SWQpO1xuICB9XG4gIHNjYW5UaW1lb3V0SWQgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgc2NhblRpbWVvdXRJZCA9IG51bGw7XG4gICAgc2NhbkZvckF0dGFjaG1lbnRzKGRvY3VtZW50KTtcbiAgfSwgUkVTQ0FOX0RFQk9VTkNFX01TKTtcbn1cblxuZnVuY3Rpb24gc2V0dXBPYnNlcnZlcnMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG5cbiAgaWYgKCFkb2N1bWVudC5ib2R5KSB7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAnRE9NQ29udGVudExvYWRlZCcsXG4gICAgICAoKSA9PiBzZXR1cE9ic2VydmVycygpLFxuICAgICAgeyBvbmNlOiB0cnVlIH0sXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG9ic2VydmVyKSByZXR1cm47XG5cbiAgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgY29uc3Qgcm9vdHMgPSBuZXcgU2V0PFF1ZXJ5Um9vdD4oKTtcbiAgICBsZXQgc2hvdWxkU2NhbiA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCBtIG9mIG11dGF0aW9ucykge1xuICAgICAgaWYgKG0udHlwZSAhPT0gJ2NoaWxkTGlzdCcpIGNvbnRpbnVlO1xuXG4gICAgICAvLyBPcHRpbWl6YXRpb246IGZpbHRlciBvdXQgb3VyIG93biBtdXRhdGlvbnNcbiAgICAgIGNvbnN0IGlzSW50ZXJuYWwgPSBBcnJheS5mcm9tKG0uYWRkZWROb2Rlcykuc29tZShuID0+IFxuICAgICAgICBuLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSAmJiBcbiAgICAgICAgKG4gYXMgRWxlbWVudCkuaGFzQXR0cmlidXRlKElOSkVDVEVEX0FUVFIpXG4gICAgICApO1xuICAgICAgaWYgKGlzSW50ZXJuYWwpIGNvbnRpbnVlO1xuXG4gICAgICBzaG91bGRTY2FuID0gdHJ1ZTtcbiAgICAgIG0uYWRkZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAgIHJvb3RzLmFkZChub2RlIGFzIEhUTUxFbGVtZW50KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHNob3VsZFNjYW4pIHtcbiAgICAgIGlmIChyb290cy5zaXplID09PSAwKSB7XG4gICAgICAgIHNjaGVkdWxlU2NhbigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcm9vdHMuZm9yRWFjaCgocm9vdCkgPT4gc2NhbkZvckF0dGFjaG1lbnRzKHJvb3QpKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICB9KTtcblxuICB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIHNjaGVkdWxlU2NhbigpO1xuICB9LCBSRVNDQU5fSU5URVJWQUxfTVMpO1xuXG4gIHNjaGVkdWxlU2NhbigpO1xufVxuXG5mdW5jdGlvbiBzY2FuRm9yQXR0YWNobWVudHMocm9vdDogUXVlcnlSb290ID0gZG9jdW1lbnQpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGluamVjdFNpbmdsZUZpbGVCdXR0b25zKHJvb3QpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogU2luZ2xlLWZpbGUgYnV0dG9uc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaW5qZWN0U2luZ2xlRmlsZUJ1dHRvbnMocm9vdDogUXVlcnlSb290ID0gZG9jdW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgYW5jaG9ycyA9IEFycmF5LmZyb20oXG4gICAgcm9vdC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxBbmNob3JFbGVtZW50PihEUklWRV9BTkNIT1JfU0VMRUNUT1IpLFxuICApO1xuXG4gIGZvciAoY29uc3QgYW5jaG9yIG9mIGFuY2hvcnMpIHtcbiAgICBjb25zdCB1cmwgPSBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKGFuY2hvcik7XG4gICAgaWYgKCF1cmwpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgY29udGFpbmVyID1cbiAgICAgIChhbmNob3IuY2xvc2VzdChBVFRBQ0hNRU5UX0NPTlRBSU5FUl9TRUxFQ1RPUikgYXMgSFRNTEVsZW1lbnQgfCBudWxsKSB8fFxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQgfHxcbiAgICAgIGFuY2hvcjtcblxuICAgIGlmICghY29udGFpbmVyKSBjb250aW51ZTtcblxuICAgIC8vIEZJWDogXCJOb3JtYWwgYnV0dG9ucyBkb2Vzbid0IGFwcGVhclwiXG4gICAgLy8gV2Ugc3RyaWN0bHkgY2hlY2sgaWYgdGhlIGJ1dHRvbiAqZXhpc3RzKiBpbnNpZGUuIFxuICAgIC8vIElmIFJlYWN0IHJlLXJlbmRlcmVkIHRoZSBjb250YWluZXIgY29udGVudCwgdGhlIGJ1dHRvbiBpcyBnb25lLCBzbyB3ZSBtdXN0IHJlLWluamVjdC5cbiAgICBpZiAoaGFzSW5qZWN0ZWRCdXR0b24oY29udGFpbmVyKSkgY29udGludWU7XG5cbiAgICBpbmplY3RCdXR0b25JbnRvQXR0YWNobWVudChjb250YWluZXIsIHVybCk7XG4gIH1cblxuICAvLyBIYW5kbGUgZGF0YS1kcml2ZS1pZCBlbGVtZW50cyAocHJldmlld3MpXG4gIGNvbnN0IG1ldGFFbGVtZW50cyA9IEFycmF5LmZyb20oXG4gICAgcm9vdC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICAgICdbZGF0YS1kcml2ZS1pZF0sIFtkYXRhLWlkXVtkYXRhLWl0ZW0taWRdLCBbZGF0YS1pZF1bZGF0YS10b29sdGlwXScsXG4gICAgKSxcbiAgKTtcblxuICBmb3IgKGNvbnN0IGVsIG9mIG1ldGFFbGVtZW50cykge1xuICAgIGlmIChoYXNJbmplY3RlZEJ1dHRvbihlbCkpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgdXJsID0gZmluZERyaXZlVXJsKGVsKTtcbiAgICBpZiAoIXVybCkgY29udGludWU7XG5cbiAgICBpbmplY3RCdXR0b25JbnRvQXR0YWNobWVudChlbCwgdXJsKTtcbiAgfVxufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogVVJMIC8gRE9NIEhlbHBlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGhhc0luamVjdGVkQnV0dG9uKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBib29sZWFuIHtcbiAgLy8gV2UgY2hlY2sgaWYgdGhlIGJ1dHRvbiBpcyBhY3R1YWxseSBpbiB0aGUgRE9NXG4gIHJldHVybiAhIWNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKGBbJHtJTkpFQ1RFRF9BVFRSfT1cInRydWVcIl1gKTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdERyaXZlVXJsRnJvbUFuY2hvcihhbmNob3I6IEhUTUxBbmNob3JFbGVtZW50KTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IGhyZWYgPSBhbmNob3IuaHJlZjtcbiAgaWYgKCFocmVmKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIERSSVZFX1VSTF9QQVRURVJOUy5zb21lKChyZSkgPT4gcmUudGVzdChocmVmKSkgPyBocmVmIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gZmluZERyaXZlVXJsKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IG5lYXJBbmNob3IgPVxuICAgIGVsZW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MQW5jaG9yRWxlbWVudD4oRFJJVkVfQU5DSE9SX1NFTEVDVE9SKSB8fFxuICAgIChlbGVtZW50LmNsb3Nlc3QoRFJJVkVfQU5DSE9SX1NFTEVDVE9SKSBhcyBIVE1MQW5jaG9yRWxlbWVudCB8IG51bGwpO1xuXG4gIGlmIChuZWFyQW5jaG9yKSB7XG4gICAgY29uc3QgaHJlZiA9IGV4dHJhY3REcml2ZVVybEZyb21BbmNob3IobmVhckFuY2hvcik7XG4gICAgaWYgKGhyZWYpIHJldHVybiBocmVmO1xuICB9XG5cbiAgY29uc3QgZHJpdmVJZCA9XG4gICAgZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZHJpdmUtaWQnKSB8fCBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1pZCcpO1xuICBpZiAoZHJpdmVJZCkge1xuICAgIHJldHVybiB0b0Rvd25sb2FkVXJsKFxuICAgICAgYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtlbmNvZGVVUklDb21wb25lbnQoXG4gICAgICAgIGRyaXZlSWQsXG4gICAgICApfWAsXG4gICAgKTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0QXV0aFVzZXIoKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XG4gIGlmIChwYXJhbXMuaGFzKCdhdXRodXNlcicpKSByZXR1cm4gcGFyYW1zLmdldCgnYXV0aHVzZXInKTtcbiAgaWYgKHBhcmFtcy5oYXMoJ3UnKSkgcmV0dXJuIHBhcmFtcy5nZXQoJ3UnKTtcbiAgY29uc3QgcGF0aE1hdGNoID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLm1hdGNoKC9cXC91XFwvKFxcZCspXFwvLyk7XG4gIGlmIChwYXRoTWF0Y2gpIHJldHVybiBwYXRoTWF0Y2hbMV07XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiB0b0Rvd25sb2FkVXJsKG9yaWdpbmFsVXJsOiBzdHJpbmcsIGRlcHRoID0gMCk6IHN0cmluZyB7XG4gIGlmIChkZXB0aCA+IDMpIHJldHVybiBvcmlnaW5hbFVybDtcbiAgY29uc3QgYXV0aFVzZXIgPSBnZXRBdXRoVXNlcigpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gbmV3IFVSTChvcmlnaW5hbFVybCwgbG9jYXRpb24uaHJlZik7XG4gICAgY29uc3QgYXBwZW5kQXV0aCA9ICh1OiBzdHJpbmcpID0+IHtcbiAgICAgIGlmICghYXV0aFVzZXIpIHJldHVybiB1O1xuICAgICAgY29uc3QgbmV3VSA9IG5ldyBVUkwodSk7XG4gICAgICBpZiAoIW5ld1Uuc2VhcmNoUGFyYW1zLmhhcygnYXV0aHVzZXInKSkge1xuICAgICAgICBuZXdVLnNlYXJjaFBhcmFtcy5zZXQoJ2F1dGh1c2VyJywgYXV0aFVzZXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld1UudG9TdHJpbmcoKTtcbiAgICB9O1xuXG4gICAgaWYgKHBhcnNlZC5ob3N0bmFtZSA9PT0gJ2RyaXZlLmdvb2dsZS5jb20nKSB7XG4gICAgICBpZiAocGFyc2VkLnBhdGhuYW1lLnN0YXJ0c1dpdGgoJy9hdXRoX3dhcm11cCcpKSB7XG4gICAgICAgIGNvbnN0IGNvbnQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnY29udGludWUnKTtcbiAgICAgICAgaWYgKGNvbnQpIHJldHVybiB0b0Rvd25sb2FkVXJsKGNvbnQsIGRlcHRoICsgMSk7XG4gICAgICAgIGNvbnN0IGlkID0gcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ2lkJyk7XG4gICAgICAgIGlmIChpZCkgcmV0dXJuIGFwcGVuZEF1dGgoYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtpZH1gKTtcbiAgICAgICAgcmV0dXJuIGFwcGVuZEF1dGgob3JpZ2luYWxVcmwpO1xuICAgICAgfVxuICAgICAgY29uc3QgZmlsZU1hdGNoID0gcGFyc2VkLnBhdGhuYW1lLm1hdGNoKC9eXFwvZmlsZVxcL2RcXC8oW14vXSspLyk7XG4gICAgICBpZiAoZmlsZU1hdGNoKSB7XG4gICAgICAgIHJldHVybiBhcHBlbmRBdXRoKGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZmlsZU1hdGNoWzFdfWApO1xuICAgICAgfVxuICAgICAgaWYgKHBhcnNlZC5wYXRobmFtZSA9PT0gJy9vcGVuJyB8fCBwYXJzZWQucGF0aG5hbWUgPT09ICcvdWMnKSB7XG4gICAgICAgIHBhcnNlZC5zZWFyY2hQYXJhbXMuc2V0KCdleHBvcnQnLCAnZG93bmxvYWQnKTtcbiAgICAgICAgaWYgKGF1dGhVc2VyKSBwYXJzZWQuc2VhcmNoUGFyYW1zLnNldCgnYXV0aHVzZXInLCBhdXRoVXNlcik7XG4gICAgICAgIHJldHVybiBwYXJzZWQudG9TdHJpbmcoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocGFyc2VkLmhvc3RuYW1lID09PSAnY2xhc3Nyb29tLmdvb2dsZS5jb20nICYmIHBhcnNlZC5wYXRobmFtZS5zdGFydHNXaXRoKCcvZHJpdmUnKSkge1xuICAgICAgY29uc3QgaWQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnaWQnKSB8fCBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgncmVzb3VyY2VJZCcpIHx8IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdmaWxlSWQnKTtcbiAgICAgIGlmIChpZCkgcmV0dXJuIGFwcGVuZEF1dGgoYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtpZH1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXBwZW5kQXV0aChvcmlnaW5hbFVybCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBvcmlnaW5hbFVybDtcbiAgfVxufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRmlsZSBtZXRhZGF0YSBleHRyYWN0aW9uXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuLy8gKEtlZXBpbmcgZXhpc3RpbmcgbG9naWMgZm9yIGJyZXZpdHkgLSBubyBjaGFuZ2VzIG5lZWRlZCBoZXJlKVxuZnVuY3Rpb24gY2xlYW5BdHRhY2htZW50TmFtZShyYXdOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIXJhd05hbWUpIHJldHVybiAnJztcbiAgbGV0IG5hbWUgPSByYXdOYW1lLnRyaW0oKTtcbiAgY29uc3QgZ2FyYmFnZUxhYmVscyA9IFsnTWljcm9zb2Z0IEV4Y2VsJywgJ01pY3Jvc29mdCBXb3JkJywgJ01pY3Jvc29mdCBQb3dlclBvaW50JywgJ0NvbXByZXNzZWQgYXJjaGl2ZScsICdCaW5hcnknLCAnVW5rbm93bicsICdHb29nbGUgU2hlZXRzJywgJ0dvb2dsZSBEb2NzJywgJ0dvb2dsZSBTbGlkZXMnLCAnVGV4dCBGaWxlJywgJ1BERicsICdWaWRlbycsICdJbWFnZScsICdBdWRpbycsICdUZXh0JywgJ1dvcmQnLCAnRXhjZWwnLCAnUG93ZXJQb2ludCcsICdBcmNoaXZlJywgJ1ppcCcsICdGaWxlJywgJ0RvY3VtZW50JywgJ1Nob3J0Y3V0JywgJ0NvZGUnXTtcbiAgZm9yIChjb25zdCBsYWJlbCBvZiBnYXJiYWdlTGFiZWxzKSB7XG4gICAgaWYgKG5hbWUuZW5kc1dpdGgobGFiZWwpKSB7XG4gICAgICBjb25zdCBwb3RlbnRpYWwgPSBuYW1lLnNsaWNlKDAsIC1sYWJlbC5sZW5ndGgpLnRyaW0oKTtcbiAgICAgIGlmIChwb3RlbnRpYWwubGVuZ3RoID4gMCkgeyBuYW1lID0gcG90ZW50aWFsOyBicmVhazsgfVxuICAgIH1cbiAgfVxuICBpZiAobmFtZS5sZW5ndGggPiAwICYmIG5hbWUubGVuZ3RoICUgMiA9PT0gMCkge1xuICAgIGNvbnN0IG1pZCA9IG5hbWUubGVuZ3RoIC8gMjtcbiAgICBpZiAobmFtZS5zbGljZSgwLCBtaWQpID09PSBuYW1lLnNsaWNlKG1pZCkpIHJldHVybiBuYW1lLnNsaWNlKDAsIG1pZCk7XG4gIH1cbiAgY29uc3QgcmVwZWF0UmVnZXggPSAvXFwuKFthLXpBLVowLTldezIsMTB9KVxcMSQvaTtcbiAgY29uc3QgcmVwZWF0TWF0Y2ggPSBuYW1lLm1hdGNoKHJlcGVhdFJlZ2V4KTtcbiAgaWYgKHJlcGVhdE1hdGNoKSByZXR1cm4gbmFtZS5zbGljZSgwLCAtcmVwZWF0TWF0Y2hbMV0ubGVuZ3RoKS50cmltKCk7XG4gIHJldHVybiBuYW1lO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0RmlsZU1ldGEoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdXJsOiBzdHJpbmcpOiBGaWxlTWV0YSB7XG4gIGxldCBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGNvbnN0IHRvb2x0aXAgPSBjb250YWluZXIuZ2V0QXR0cmlidXRlKCdkYXRhLXRvb2x0aXAnKSB8fCBjb250YWluZXIuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgfHwgY29udGFpbmVyLmdldEF0dHJpYnV0ZSgndGl0bGUnKTtcbiAgaWYgKHRvb2x0aXAgJiYgdG9vbHRpcC50cmltKCkpIG5hbWUgPSB0b29sdGlwLnRyaW0oKTtcbiAgaWYgKCFuYW1lKSB7XG4gICAgY29uc3QgdGV4dCA9IChjb250YWluZXIudGV4dENvbnRlbnQgfHwgJycpLnRyaW0oKTtcbiAgICBpZiAodGV4dCkge1xuICAgICAgY29uc3QgbGluZXMgPSB0ZXh0LnNwbGl0KCdcXG4nKS5tYXAoKGwpID0+IGwudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAobGluZXMubGVuZ3RoID4gMCkgbmFtZSA9IGxpbmVzWzBdO1xuICAgIH1cbiAgfVxuICBpZiAoIW5hbWUpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdSA9IG5ldyBVUkwodXJsKTtcbiAgICAgIGNvbnN0IHBhdGhOYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHUucGF0aG5hbWUuc3BsaXQoJy8nKS5wb3AoKSB8fCAnJyk7XG4gICAgICBpZiAocGF0aE5hbWUgJiYgcGF0aE5hbWUuaW5jbHVkZXMoJy4nKSkgbmFtZSA9IHBhdGhOYW1lO1xuICAgIH0gY2F0Y2gge31cbiAgfVxuICBpZiAobmFtZSkgbmFtZSA9IGNsZWFuQXR0YWNobWVudE5hbWUobmFtZSk7XG5cbiAgbGV0IGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBpZiAobmFtZSkge1xuICAgIGNvbnN0IG0gPSBuYW1lLm1hdGNoKC9cXC4oW2EtekEtWjAtOV17MiwxMH0pJC8pO1xuICAgIGlmIChtKSBleHQgPSBtWzFdLnRvTG93ZXJDYXNlKCk7XG4gIH1cbiAgLy8gS2luZCBsb2dpYyBvbWl0dGVkIGZvciBicmV2aXR5LCBhc3N1bWUgaWRlbnRpY2FsIHRvIHByZXZpb3VzLi4uXG4gIHJldHVybiB7IG5hbWUsIGV4dCwga2luZDogJ290aGVyJyB9OyBcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEJ1dHRvbiBpbmplY3Rpb25cbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHVybDogc3RyaW5nKTogdm9pZCB7XG4gIGlmICghdXJsKSByZXR1cm47XG4gIFxuICAvLyBNYXJrIGFzIHByb2Nlc3NlZCAobWV0YWRhdGEgb25seSlcbiAgY29udGFpbmVyLnNldEF0dHJpYnV0ZShQUk9DRVNTRURfQVRUUiwgJ3RydWUnKTtcblxuICBjb25zdCBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGNvbnRhaW5lcik7XG4gIGlmIChjb21wdXRlZC5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIGNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG5cbiAgY29uc3QgZGlyZWN0VXJsID0gdG9Eb3dubG9hZFVybCh1cmwpO1xuICBjb25zdCBmaWxlTWV0YSA9IGV4dHJhY3RGaWxlTWV0YShjb250YWluZXIsIGRpcmVjdFVybCk7XG4gIGNvbnN0IGJ1dHRvbiA9IGNyZWF0ZURvd25sb2FkQnV0dG9uKGNvbnRhaW5lciwgZGlyZWN0VXJsLCBmaWxlTWV0YSk7XG5cbiAgY29uc3QgaWNvbkVsID0gYnV0dG9uLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY3FkLWRvd25sb2FkLWljb24nKTtcbiAgaWYgKGljb25FbCkgaWNvbkVsLmNsYXNzTGlzdC5hZGQoJ2NxZC1pY29uLW1lZGl1bScpO1xuXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChidXR0b24pO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQnV0dG9uIHN0YXRlIGhlbHBlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGdldEJ1dHRvblN0YXRlKGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQpOiBCdXR0b25TdGF0ZSB7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtbG9hZGluZycpKSByZXR1cm4gJ2xvYWRpbmcnO1xuICBpZiAoYnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnY3FkLXRyeWluZycpKSByZXR1cm4gJ3RyeWluZyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtc3VjY2VzcycpKSByZXR1cm4gJ3N1Y2Nlc3MnO1xuICBpZiAoYnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnY3FkLWVycm9yJykpIHJldHVybiAnZXJyb3InO1xuICByZXR1cm4gJ2lkbGUnO1xufVxuXG5mdW5jdGlvbiBzZXRCdXR0b25TdGF0ZShcbiAgYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCxcbiAgc3RhdGU6IEJ1dHRvblN0YXRlLFxuICBvcHRpb25zPzogeyB1c2VyTWVzc2FnZT86IHN0cmluZyB9LFxuKTogdm9pZCB7XG4gIGNvbnN0IGljb24gPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtaWNvbicpO1xuICBjb25zdCBsYWJlbCA9IGJ1dHRvbi5xdWVyeVNlbGVjdG9yPEhUTUxTcGFuRWxlbWVudD4oJy5jcWQtbGFiZWwnKTtcbiAgY29uc3QgZXJyb3JEZXRhaWwgPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MU3BhbkVsZW1lbnQ+KCcuY3FkLWVycm9yLWRldGFpbCcpO1xuICBpZiAoIWljb24gfHwgIWxhYmVsIHx8ICFlcnJvckRldGFpbCkgcmV0dXJuO1xuXG4gIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdjcWQtbG9hZGluZycsICdjcWQtdHJ5aW5nJywgJ2NxZC1zdWNjZXNzJywgJ2NxZC1lcnJvcicpO1xuICBpY29uLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1zcGlubmVyJyk7XG4gIGljb24udGV4dENvbnRlbnQgPSAnJztcbiAgYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJztcbiAgbGFiZWwudGV4dENvbnRlbnQgPSB0KCdkb3dubG9hZCcpO1xuICBlcnJvckRldGFpbC50ZXh0Q29udGVudCA9ICcnO1xuXG4gIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKWA7XG4gIGljb24uc3R5bGUuYmFja2dyb3VuZFNpemUgPSAnJztcblxuICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgY2FzZSAnaWRsZSc6XG4gICAgICBicmVhaztcbiAgICBjYXNlICdsb2FkaW5nJzpcbiAgICBjYXNlICd0cnlpbmcnOiB7XG4gICAgICBjb25zdCBpc1RyeWluZyA9IHN0YXRlID09PSAndHJ5aW5nJztcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKGlzVHJ5aW5nID8gJ2NxZC10cnlpbmcnIDogJ2NxZC1sb2FkaW5nJyk7XG4gICAgICBidXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSBpc1RyeWluZyA/IHQoJ3RyeWluZycpIDogdCgnZG93bmxvYWRpbmcnKTtcbiAgICAgIGljb24uY2xhc3NMaXN0LmFkZCgnY3FkLXNwaW5uZXInKTtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJ25vbmUnO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgJ3N1Y2Nlc3MnOlxuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC1zdWNjZXNzJyk7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9IHQoJ2Rvd25sb2FkZWQnKTtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7U1VDQ0VTU19JQ09OX1NWR19VUkx9XCIpYDtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZFNpemUgPSAnMjBweCAyMHB4JztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtZXJyb3InKTtcbiAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gdCgnZXJyb3InKTtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7RVJST1JfSUNPTl9TVkdfVVJMfVwiKWA7XG4gICAgICBpY29uLnN0eWxlLmJhY2tncm91bmRTaXplID0gJzIwcHggMjBweCc7XG4gICAgICBlcnJvckRldGFpbC50ZXh0Q29udGVudCA9IG9wdGlvbnM/LnVzZXJNZXNzYWdlIHx8IHQoJ2ZhaWxlZCcpO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2V0UGlsbFByb2dyZXNzKGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsIGZyYWN0aW9uOiBudW1iZXIpOiB2b2lkIHtcbiAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIGZyYWN0aW9uIHx8IDApKTtcbiAgYnV0dG9uLnN0eWxlLnNldFByb3BlcnR5KCctLWNxZC1wcm9ncmVzcycsIGAke2NsYW1wZWQgKiAxMDB9JWApO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQnV0dG9uIGZhY3RvcnlcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGNyZWF0ZURvd25sb2FkQnV0dG9uKFxuICBfY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgdXJsOiBzdHJpbmcsXG4gIGZpbGVNZXRhOiBGaWxlTWV0YSxcbik6IEhUTUxCdXR0b25FbGVtZW50IHtcbiAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gIGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG4gIGJ1dHRvbi5jbGFzc05hbWUgPSAnY3FkLWRvd25sb2FkLWJ0bic7XG5cbiAgaWYgKGlzUGFnZURhcmsoKSkge1xuICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtdGhlbWUtZGFyaycpO1xuICB9XG5cbiAgYnV0dG9uLnNldEF0dHJpYnV0ZShJTkpFQ1RFRF9BVFRSLCAndHJ1ZScpO1xuICBidXR0b24uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYCR7dCgnYXJpYURvd25sb2FkJyl9ICR7ZmlsZU1ldGEubmFtZSB8fCAnJ31gKTtcbiAgYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCB0KCd0aXRsZVF1aWNrJykpO1xuXG4gIC8vIERhdGEgZm9yIGdyb3VwaW5nXG4gIHRyeSB7XG4gICAgaWYgKHVybCkgKGJ1dHRvbi5kYXRhc2V0IGFzIGFueSkuY3FkVXJsID0gdXJsO1xuICAgIGlmIChmaWxlTWV0YT8ubmFtZSkgKGJ1dHRvbi5kYXRhc2V0IGFzIGFueSkuY3FkTmFtZSA9IGZpbGVNZXRhLm5hbWU7XG4gICAgaWYgKGZpbGVNZXRhPy5leHQpIChidXR0b24uZGF0YXNldCBhcyBhbnkpLmNxZEV4dCA9IGZpbGVNZXRhLmV4dDtcbiAgfSBjYXRjaCB7fVxuXG4gIGNvbnN0IGljb25XcmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBpY29uV3JhcHBlci5jbGFzc05hbWUgPSAnY3FkLWljb24td3JhcHBlcic7XG4gIGNvbnN0IGljb25TcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBpY29uU3Bhbi5jbGFzc05hbWUgPSAnY3FkLWRvd25sb2FkLWljb24nO1xuICBpY29uV3JhcHBlci5hcHBlbmRDaGlsZChpY29uU3Bhbik7XG5cbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjcWQtbGFiZWwnO1xuICBsYWJlbC50ZXh0Q29udGVudCA9IHQoJ2Rvd25sb2FkJyk7XG5cbiAgY29uc3QgZXJyb3JEZXRhaWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGVycm9yRGV0YWlsLmNsYXNzTmFtZSA9ICdjcWQtZXJyb3ItZGV0YWlsJztcblxuICBidXR0b24uYXBwZW5kQ2hpbGQoaWNvbldyYXBwZXIpO1xuICBidXR0b24uYXBwZW5kQ2hpbGQobGFiZWwpO1xuICBidXR0b24uYXBwZW5kQ2hpbGQoZXJyb3JEZXRhaWwpO1xuXG4gIGNvbnN0IGNsaWNrSGFuZGxlciA9IGFzeW5jIChlOiBFdmVudCkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGF3YWl0IGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soYnV0dG9uLCB1cmwsIGZpbGVNZXRhKTtcbiAgfTtcblxuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjbGlja0hhbmRsZXIpO1xuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignYXV4Y2xpY2snLCAoZSkgPT4geyBpZiAoZS5idXR0b24gPT09IDEpIGNsaWNrSGFuZGxlcihlKTsgfSk7XG5cbiAgcmV0dXJuIGJ1dHRvbjtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIERvd25sb2FkIGNsaWNrIGhhbmRsZXJcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soXG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsXG4gIHVybDogc3RyaW5nLFxuICBmaWxlTWV0YTogRmlsZU1ldGEsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF1cmwpIHJldHVybjtcbiAgaWYgKGdldEJ1dHRvblN0YXRlKGJ1dHRvbikgIT09ICdpZGxlJykgcmV0dXJuO1xuXG4gIHNldFBpbGxQcm9ncmVzcyhidXR0b24sIDApO1xuXG4gIGNvbnN0IHJlcXVlc3RJZCA9IGBjcWQtJHtEYXRlLm5vdygpfS0ke25leHRSZXF1ZXN0U2VxKyt9YDtcbiAgY29uc3Qgc3RhcnRlZEF0ID0gRGF0ZS5ub3coKTtcblxuICBwZW5kaW5nQnV0dG9ucy5zZXQocmVxdWVzdElkLCB7IGJ1dHRvbiwgcmVxdWVzdElkLCBmaWxlTWV0YSwgc3RhcnRlZEF0IH0pO1xuXG4gIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ2xvYWRpbmcnKTtcblxuICBjb25zdCBzdGFydFJlc3VsdCA9IGF3YWl0IHN0YXJ0QmFja2dyb3VuZERvd25sb2FkKHJlcXVlc3RJZCwgdXJsLCBmaWxlTWV0YSk7XG5cbiAgaWYgKCFzdGFydFJlc3VsdC5vaykge1xuICAgIHBlbmRpbmdCdXR0b25zLmRlbGV0ZShyZXF1ZXN0SWQpO1xuICAgIGF3YWl0IGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0KTtcbiAgICBhd2FpdCBzaG93RXJyb3JTdGF0ZShidXR0b24sIHN0YXJ0UmVzdWx0LnVzZXJNZXNzYWdlKTtcbiAgICByZXR1cm47XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RhcnRCYWNrZ3JvdW5kRG93bmxvYWQoXG4gIHJlcXVlc3RJZDogc3RyaW5nLFxuICB1cmw6IHN0cmluZyxcbiAgZmlsZU1ldGE6IEZpbGVNZXRhLFxuKTogUHJvbWlzZTx7IG9rOiBib29sZWFuOyB1c2VyTWVzc2FnZT86IHN0cmluZyB9PiB7XG4gIGNvbnN0IGZpbmFsVXJsID0gdG9Eb3dubG9hZFVybCh1cmwpO1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBpZiAodHlwZW9mIGNocm9tZSA9PT0gJ3VuZGVmaW5lZCcgfHwgIWNocm9tZS5ydW50aW1lPy5zZW5kTWVzc2FnZSkge1xuICAgICAgcmVzb2x2ZSh7IG9rOiBmYWxzZSwgdXNlck1lc3NhZ2U6ICdSdW50aW1lIG5vdCBhdmFpbGFibGUuJyB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKFxuICAgICAgICB7IHR5cGU6ICdDUURfRE9XTkxPQUQnLCB1cmw6IGZpbmFsVXJsLCByZXF1ZXN0SWQsIGZpbGVNZXRhIH0sXG4gICAgICAgIChyZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IgfHwgIXJlc3BvbnNlIHx8IHJlc3BvbnNlLnN0YXJ0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICByZXNvbHZlKHsgb2s6IGZhbHNlLCB1c2VyTWVzc2FnZTogcmVzcG9uc2U/LnVzZXJNZXNzYWdlIHx8ICdDb3VsZCBub3Qgc3RhcnQuJyB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzb2x2ZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXNvbHZlKHsgb2s6IGZhbHNlLCB1c2VyTWVzc2FnZTogJ0NvbW0gZXJyb3IuJyB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogVUkgVXRpbHNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmFzeW5jIGZ1bmN0aW9uIHNob3dFcnJvclN0YXRlKGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsIHVzZXJNZXNzYWdlPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ2Vycm9yJywgeyB1c2VyTWVzc2FnZSB9KTtcbiAgY29uc3QgZWFybGllc3RSZXNldCA9IERhdGUubm93KCkgKyBGRUVEQkFDS19FUlJPUl9NUztcbiAgd2hpbGUgKHRydWUpIHtcbiAgICBhd2FpdCBkZWxheSgyMDApO1xuICAgIGlmIChnZXRCdXR0b25TdGF0ZShidXR0b24pICE9PSAnZXJyb3InKSByZXR1cm47XG4gICAgaWYgKERhdGUubm93KCkgPCBlYXJsaWVzdFJlc2V0KSBjb250aW51ZTtcbiAgICBpZiAoIWJ1dHRvbi5tYXRjaGVzKCc6aG92ZXInKSkge1xuICAgICAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnaWRsZScpO1xuICAgICAgc2V0UGlsbFByb2dyZXNzKGJ1dHRvbiwgMCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydGVkQXQ7XG4gIGlmIChlbGFwc2VkIDwgTE9BRElOR19NSU5fTVMpIGF3YWl0IGRlbGF5KExPQURJTkdfTUlOX01TIC0gZWxhcHNlZCk7XG59XG5cbmZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogTGlzdGVuIGZvciBiYWNrZ3JvdW5kIHN0YXR1cyB1cGRhdGVzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLnJ1bnRpbWU/Lm9uTWVzc2FnZSkge1xuICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UpID0+IHtcbiAgICBpZiAoIW1lc3NhZ2UgfHwgbWVzc2FnZS50eXBlICE9PSAnQ1FEX0RPV05MT0FEX1NUQVRVUycpIHJldHVybjtcblxuICAgIGNvbnN0IHJlcXVlc3RJZCA9IG1lc3NhZ2UucmVxdWVzdElkIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoIXJlcXVlc3RJZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgcGVuZGluZyA9IHBlbmRpbmdCdXR0b25zLmdldChyZXF1ZXN0SWQpO1xuICAgIGlmICghcGVuZGluZykgcmV0dXJuO1xuXG4gICAgY29uc3QgeyBidXR0b24sIHN0YXJ0ZWRBdCB9ID0gcGVuZGluZztcblxuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBlbnN1cmVNaW5Mb2FkaW5nKHN0YXJ0ZWRBdCk7XG5cbiAgICAgIGNvbnN0IHN0YXR1cyA9IG1lc3NhZ2Uuc3RhdHVzIGFzIEJ1dHRvblN0YXRlIHwgJ2Jsb2NrZWRfaHRtbCcgfCAnaW50ZXJydXB0ZWQnO1xuICAgICAgY29uc3QgZXJyb3JDb2RlID0gbWVzc2FnZS5lcnJvckNvZGUgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgdXNlck1lc3NhZ2UgPSBtZXNzYWdlLnVzZXJNZXNzYWdlIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgICAgaWYgKHN0YXR1cyA9PT0gJ3RyeWluZycpIHtcbiAgICAgICAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAndHJ5aW5nJywgeyB1c2VyTWVzc2FnZSB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdHVzID09PSAnc3VjY2VzcycgfHwgc3RhdHVzID09PSAnY29tcGxldGUnKSB7XG4gICAgICAgIHBlbmRpbmdCdXR0b25zLmRlbGV0ZShyZXF1ZXN0SWQpO1xuICAgICAgICBcbiAgICAgICAgLy8gTWFyayBmb3IgR3JvdXAgd2F0Y2hlclxuICAgICAgICB0cnkgeyAoYnV0dG9uLmRhdGFzZXQgYXMgYW55KS5jcWRBbGxEb25lID0gJ3RydWUnOyB9IGNhdGNoIHt9XG5cbiAgICAgICAgc2V0UGlsbFByb2dyZXNzKGJ1dHRvbiwgMSk7XG4gICAgICAgIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ3N1Y2Nlc3MnKTtcblxuICAgICAgICBhd2FpdCBkZWxheShGRUVEQkFDS19TVUNDRVNTX01TKTtcblxuICAgICAgICAvLyBSRVNFVCBMT0dJQ1xuICAgICAgICBpZiAoZ2V0QnV0dG9uU3RhdGUoYnV0dG9uKSA9PT0gJ3N1Y2Nlc3MnKSB7XG4gICAgICAgICAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnaWRsZScpO1xuICAgICAgICAgIHNldFBpbGxQcm9ncmVzcyhidXR0b24sIDApO1xuICAgICAgICAgIHRyeSB7IGRlbGV0ZSAoYnV0dG9uLmRhdGFzZXQgYXMgYW55KS5jcWRBbGxEb25lOyB9IGNhdGNoIHt9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdHVzID09PSAnZXJyb3InIHx8IHN0YXR1cyA9PT0gJ2ludGVycnVwdGVkJyB8fCBzdGF0dXMgPT09ICdibG9ja2VkX2h0bWwnKSB7XG4gICAgICAgIGlmIChlcnJvckNvZGUgPT09ICdBVVRIX0NIRUNLJykge1xuICAgICAgICAgIGF3YWl0IHNob3dFcnJvclN0YXRlKGJ1dHRvbiwgdXNlck1lc3NhZ2UpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBwZW5kaW5nQnV0dG9ucy5kZWxldGUocmVxdWVzdElkKTtcbiAgICAgICAgc2V0UGlsbFByb2dyZXNzKGJ1dHRvbiwgMCk7XG4gICAgICAgIGF3YWl0IHNob3dFcnJvclN0YXRlKGJ1dHRvbiwgdXNlck1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH0pKCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpbml0Q29udGVudFNjcmlwdCgpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGluamVjdFN0eWxlcygpO1xuICBzZXR1cE9ic2VydmVycygpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovL2NsYXNzcm9vbS5nb29nbGUuY29tLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgbWFpbigpIHsgaW5pdENvbnRlbnRTY3JpcHQoKTsgfSxcbn0pOyIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNDTyxRQUFNLHdCQUF3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBUzlCLFFBQU0sdUJBQXVCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVU3QixRQUFNLHFCQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFRM0IsUUFBTSx3QkFBd0IsMkJBQTJCO0FBQUEsSUFDOUQ7QUFBQSxFQUNGLENBQUM7QUFFTSxRQUFNLHVCQUF1QiwyQkFBMkI7QUFBQSxJQUM3RDtBQUFBLEVBQ0YsQ0FBQztBQUVNLFFBQU0scUJBQXFCLDJCQUEyQjtBQUFBLElBQzNEO0FBQUEsRUFDRixDQUFDO0FDcENELFFBQU0sV0FBVztBQUNqQixRQUFNLGtCQUFrQjtBQUV4QixRQUFNLGdCQUFnQjtBQUN0QixRQUFNLGlCQUFpQixHQUFHLGFBQWE7QUFFaEMsV0FBUyxlQUFxQjtBQUNuQyxRQUFJLE9BQU8sYUFBYSxZQUFhO0FBQ3JDLFFBQUksU0FBUyxlQUFlLFFBQVEsRUFBRztBQUV2QyxVQUFNLFFBQVEsU0FBUyxjQUFjLE9BQU87QUFDNUMsVUFBTSxLQUFLO0FBQ1gsVUFBTSxjQUFjO0FBQUE7QUFBQSwwQkFFSSxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFtSVQscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFpSnJDLGVBQWU7QUFBQSxnQkFDZCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFB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LGVBQUEsS0FBQSxRQUFBLGFBQUEsU0FBQTtBQUVBLFFBQUEsU0FBQTtBQUNFLGFBQUE7QUFBQSxRQUFPLGtEQUFBO0FBQUEsVUFDNkM7QUFBQSxRQUNoRCxDQUFBO0FBQUEsTUFDRDtBQUFBLElBQ0g7QUFFRixXQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsY0FBQTtBQUNFLFFBQUEsT0FBQSxXQUFBLFlBQUEsUUFBQTtBQUNBLFVBQUEsU0FBQSxJQUFBLGdCQUFBLE9BQUEsU0FBQSxNQUFBO0FBQ0EsUUFBQSxPQUFBLElBQUEsVUFBQSxFQUFBLFFBQUEsT0FBQSxJQUFBLFVBQUE7QUFDQSxRQUFBLE9BQUEsSUFBQSxHQUFBLEVBQUEsUUFBQSxPQUFBLElBQUEsR0FBQTtBQUNBLFVBQUEsWUFBQSxPQUFBLFNBQUEsU0FBQSxNQUFBLGNBQUE7QUFDQSxRQUFBLFVBQUEsUUFBQSxVQUFBLENBQUE7QUFDQSxXQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsY0FBQSxhQUFBLFFBQUEsR0FBQTtBQUNFLFFBQUEsUUFBQSxFQUFBLFFBQUE7QUFDQSxVQUFBLFdBQUEsWUFBQTtBQUVBLFFBQUE7QUFDRSxZQUFBLFNBQUEsSUFBQSxJQUFBLGFBQUEsU0FBQSxJQUFBO0FBQ0EsWUFBQSxhQUFBLENBQUEsTUFBQTtBQUNFLFlBQUEsQ0FBQSxTQUFBLFFBQUE7QUFDQSxjQUFBLE9BQUEsSUFBQSxJQUFBLENBQUE7QUFDQSxZQUFBLENBQUEsS0FBQSxhQUFBLElBQUEsVUFBQSxHQUFBO0FBQ0UsZUFBQSxhQUFBLElBQUEsWUFBQSxRQUFBO0FBQUEsUUFBMEM7QUFFNUMsZUFBQSxLQUFBLFNBQUE7QUFBQSxNQUFxQjtBQUd2QixVQUFBLE9BQUEsYUFBQSxvQkFBQTtBQUNFLFlBQUEsT0FBQSxTQUFBLFdBQUEsY0FBQSxHQUFBO0FBQ0UsZ0JBQUEsT0FBQSxPQUFBLGFBQUEsSUFBQSxVQUFBO0FBQ0EsY0FBQSxLQUFBLFFBQUEsY0FBQSxNQUFBLFFBQUEsQ0FBQTtBQUNBLGdCQUFBLEtBQUEsT0FBQSxhQUFBLElBQUEsSUFB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QUFBLENBQUEsU0FBQSxDQUFBLFlBQUE7QUFFQSxXQUFBLFVBQUEsT0FBQSxlQUFBLGNBQUEsZUFBQSxXQUFBO0FBQ0EsU0FBQSxVQUFBLE9BQUEsYUFBQTtBQUNBLFNBQUEsY0FBQTtBQUNBLFdBQUEsV0FBQTtBQUNBLFdBQUEsTUFBQSxrQkFBQTtBQUNBLFVBQUEsY0FBQSxFQUFBLFVBQUE7QUFDQSxnQkFBQSxjQUFBO0FBRUEsU0FBQSxNQUFBLGtCQUFBLFFBQUEscUJBQUE7QUFDQSxTQUFBLE1BQUEsaUJBQUE7QUFFQSxZQUFBLE9BQUE7QUFBQSxNQUFlLEtBQUE7QUFFWDtBQUFBLE1BQUEsS0FBQTtBQUFBLE1BQ0csS0FBQSxVQUFBO0FBRUgsY0FBQSxXQUFBLFVBQUE7QUFDQSxlQUFBLFVBQUEsSUFBQSxXQUFBLGVBQUEsYUFBQTtBQUNBLGVBQUEsV0FBQTtBQUNBLGNBQUEsY0FBQSxXQUFBLEVBQUEsUUFBQSxJQUFBLEVBQUEsYUFBQTtBQUNBLGFBQUEsVUFBQSxJQUFBLGFBQUE7QUFDQSxhQUFBLE1BQUEsa0JBQUE7QUFDQTtBQUFBLE1BQUE7QUFBQSxNQUNGLEtBQUE7QUFFRSxlQUFBLFVBQUEsSUFBQSxhQUFBO0FBQ0EsY0FBQSxjQUFBLEVBQUEsWUFBQTtBQUNBLGFBQUEsTUFBQSxrQkFBQSxRQUFBLG9CQUFBO0FBQ0EsYUFBQSxNQUFBLGlCQUFBO0FBQ0E7QUFBQSxNQUFBLEtBQUE7QUFFQSxlQUFBLFVBQUEsSUFBQSxXQUFBO0FBQ0EsY0FBQSxjQUFBLEVBQUEsT0FBQTtBQUNBLGFBQUEsTUFBQSxrQkFBQSxRQUFBLGtCQUFBO0FBQ0EsYUFBQSxNQUFBLGlCQUFBO0FBQ0Esb0JBQUEsY0FBQSxTQUFBLGVBQUEsRUFBQSxRQUFBO0FBQ0E7QUFBQSxJQUFBO0FBQUEsRUFFTjtBQUVBLFdBQUEsZ0JBQUEsUUFBQSxVQUFBO0FBQ0UsVUFBQSxVQUFBLEtBQUEsSUFBQSxHQUFBLEtBQUEsSUFBQSxHQUFBLFlBQUEsQ0FBQSxDQUFBO0FBQ0EsV0FBQSxNQUFBLFlBQUEsa0JBQUEsR0FBQSxVQUFBLEdBQUEsR0FBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLHFCQUFBLFlBQUEsS0FBQSxVQUFBO0FBS0UsVUFBQSxTQUFBLFNBQUEsY0FBQSxRQUFBO0FBQ0EsV0FBQSxPQUFBO0FBQ0EsV0FBQSxZQUFBO0FBRUEsUUFBQSxXQUFBLEdBQUE7QUFDRSxhQUFBLFVBQUEsSUFBQSxnQkFBQTtBQUFBLElBQXFDO0FBR3ZDLFdBQUEsYUFBQSxlQUFBLE1BQUE7QUFDQSxXQUFBLGFBQUEsY0FBQSxHQUFBLEVBQUEsY0FBQSxDQUFBLElBQUEsU0FBQSxRQUFBLEVBQUEsRUFBQTtBQUNBLFdBQUEsYUFBQSxTQUFBLEVBQUEsWUFBQSxDQUFBO0FBR0EsUUFBQTtBQUNFLFVBQUEsSUFBQSxRQUFBLFFBQUEsU0FBQTtBQUNBLFVBQUEsVUFBQSxLQUFBLFFBQUEsUUFBQSxVQUFBLFNBQUE7QUFDQSxVQUFBLFVBQUEsSUFBQSxRQUFBLFFBQUEsU0FBQSxTQUFBO0FBQUEsSUFBNkQsUUFBQTtBQUFBLElBQ3ZEO0FBRVIsVUFBQSxjQUFBLFNBQUEsY0FBQSxNQUFBO0FBQ0EsZ0JBQUEsWUFBQTtBQUNBLFVBQUEsV0FBQSxTQUFBLGNBQUEsTUFBQTtBQUNBLGFBQUEsWUFBQTtBQUNBLGdCQUFBLFlBQUEsUUFBQTtBQUVBLFVBQUEsUUFBQSxTQUFBLGNBQUEsTUFBQTtBQUNBLFVBQUEsWUFBQTtBQUNBLFVBQUEsY0FBQSxFQUFBLFVBQUE7QUFFQSxVQUFBLGNBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxnQkFBQSxZQUFBO0FBRUEsV0FBQSxZQUFBLFdBQUE7QUFDQSxXQUFBLFlBQUEsS0FBQTtBQUNBLFdBQUEsWUFBQSxXQUFBO0FBRUEsVUFBQSxlQUFBLE9BQUEsTUFBQTtBQUNFLFFBQUEsZUFBQTtBQUNBLFFBQUEsZ0JBQUE7QUFDQSxZQUFBLDBCQUFBLFFBQUEsS0FBQSxRQUFBO0FBQUEsSUFBcUQ7QUFHdkQsV0FBQSxpQkFBQSxTQUFBLFlBQUE7QUFDQSxXQUFBLGlCQUFBLFlBQUEsQ0FBQSxNQUFBO0FBQTZDLFVBQUEs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QUFPO0FBQ1YsV0FBSyxjQUFjLE1BQU0sbUJBQW1CLEVBQUUsQ0FBQztBQUMvQyxhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsaUJBQWlCLFFBQVEsTUFBTSxTQUFTLFNBQVM7QUFDL0MsVUFBSSxTQUFTLHNCQUFzQjtBQUNqQyxZQUFJLEtBQUssUUFBUyxNQUFLLGdCQUFnQixJQUFHO0FBQUEsTUFDNUM7QUFDQSxhQUFPO0FBQUEsUUFDTCxLQUFLLFdBQVcsTUFBTSxJQUFJLG1CQUFtQixJQUFJLElBQUk7QUFBQSxRQUNyRDtBQUFBLFFBQ0E7QUFBQSxVQUNFLEdBQUc7QUFBQSxVQUNILFFBQVEsS0FBSztBQUFBLFFBQ3JCO0FBQUEsTUFDQTtBQUFBLElBQ0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS0Esb0JBQW9CO0FBQ2xCLFdBQUssTUFBTSxvQ0FBb0M7QUFDL0NDLGVBQU87QUFBQSxRQUNMLG1CQUFtQixLQUFLLGlCQUFpQjtBQUFBLE1BQy9DO0FBQUEsSUFDRTtBQUFBLElBQ0EsaUJBQWlCO0FBQ2YsYUFBTztBQUFBLFFBQ0w7QUFBQSxVQUNFLE1BQU0scUJBQXFCO0FBQUEsVUFDM0IsbUJBQW1CLEtBQUs7QUFBQSxVQUN4QixXQUFXLEtBQUssT0FBTSxFQUFHLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQztBQUFBLFFBQ3JEO0FBQUEsUUFDTTtBQUFBLE1BQ047QUFBQSxJQUNFO0FBQUEsSUFDQSx5QkFBeUIsT0FBTztBQUM5QixZQUFNLHVCQUF1QixNQUFNLE1BQU0sU0FBUyxxQkFBcUI7QUFDdkUsWUFBTSxzQkFBc0IsTUFBTSxNQUFNLHNCQUFzQixLQUFLO0FBQ25FLFlBQU0saUJBQWlCLENBQUMsS0FBSyxtQkFBbUIsSUFBSSxNQUFNLE1BQU0sU0FBUztBQUN6RSxhQUFPLHdCQUF3Qix1QkFBdUI7QUFBQSxJQUN4RDtBQUFBLElBQ0Esc0JBQXNCLFNBQVM7QUFDN0IsVUFBSSxVQUFVO0FBQ2QsWUFBTSxLQUFLLENBQUMsVUFBVTtBQUNwQixZQUFJLEtBQUsseUJBQXlCLEtBQUssR0FBRztBQUN4QyxlQUFLLG1CQUFtQixJQUFJLE1BQU0sS0FBSyxTQUFTO0FBQ2hELGdCQUFNLFdBQVc7QUFDakIsb0JBQVU7QUFDVixjQUFJLFlBQVksU0FBUyxpQkFBa0I7QUFDM0MsZUFBSyxrQkFBaUI7QUFBQSxRQUN4QjtBQUFBLE1BQ0Y7QUFDQSx1QkFBaUIsV0FBVyxFQUFFO0FBQzlCLFdBQUssY0FBYyxNQUFNLG9CQUFvQixXQUFXLEVBQUUsQ0FBQztBQUFBLElBQzdEO0FBQUEsRUFDRjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDYsNyw4LDksMTAsMTFdfQ==
content;
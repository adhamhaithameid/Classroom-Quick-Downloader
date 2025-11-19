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
      --cqd-color-primary: #1a73e8;
      --cqd-color-success: #34a853;
      --cqd-color-error: #e05952;
      --cqd-frame-color: #6366f1;

      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);
      --cqd-shadow-pill: 0 8px 22px rgba(15, 23, 42, 0.30);
      --cqd-shadow-success: 0 12px 28px rgba(24, 128, 56, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(24, 128, 56, 0.70);
      --cqd-shadow-error: 0 12px 28px rgba(224, 89, 82, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(224, 89, 82, 0.70);
    }

    /* ============================================================
     * CRITICAL OVERRIDES: Force Google Card to show the Badge
     * ============================================================ */
    div[data-stream-item-id] {
        overflow: visible !important;
        contain: none !important;
        z-index: 1;
    }

    /* ===============================
     * 1. EXISTING DOWNLOAD BUTTON STYLES (Unchanged)
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
      background-color: var(--cqd-color-primary);
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
      transition: width var(--cqd-transition), padding-inline var(--cqd-transition), border-radius var(--cqd-transition), box-shadow var(--cqd-transition), transform var(--cqd-transition), background-color var(--cqd-transition);
    }
    .cqd-download-btn:not(.cqd-loading):not(.cqd-success):not(.cqd-error):hover {
      width: 120px; padding-inline: 12px; box-shadow: var(--cqd-shadow-hover); justify-content: flex-start; transform: translateY(-50%) scale(1); border-radius: 20px;
    }
    .cqd-download-btn:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
    .cqd-download-btn:active { box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3); transform: translateY(-50%) scale(0.97); }
    .cqd-download-btn .cqd-icon-wrapper { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .cqd-download-icon {
      display: block; width: 24px; height: 24px; background-image: url("${DOWNLOAD_ICON_SVG_URL}"); background-repeat: no-repeat; background-position: center; background-size: 24px 24px; flex-shrink: 0; transform-origin: center;
      transition: width var(--cqd-transition), height var(--cqd-transition), border-width var(--cqd-transition);
    }
    .cqd-icon-small { width: 16px; height: 16px; background-size: 16px 16px; }
    .cqd-icon-medium { width: 24px; height: 24px; background-size: 24px 24px; }
    .cqd-icon-large { width: 32px; height: 32px; background-size: 32px 32px; }
    .cqd-download-btn .cqd-label { opacity: 0; margin-left: 0; max-width: 0; overflow: hidden; transition: opacity var(--cqd-transition), max-width var(--cqd-transition), margin-left var(--cqd-transition); }
    .cqd-download-btn:not(.cqd-loading):not(.cqd-error):not(.cqd-success):hover .cqd-label { opacity: 1; max-width: 110px; margin-left: 4px; }
    .cqd-download-btn.cqd-loading, .cqd-download-btn.cqd-success, .cqd-download-btn.cqd-error { padding-inline: 12px; border-radius: 20px; justify-content: flex-start; box-shadow: var(--cqd-shadow-pill); cursor: default; width: 150px; transform: translateY(-50%) scale(1); }
    .cqd-download-btn.cqd-loading:active, .cqd-download-btn.cqd-success:active, .cqd-download-btn.cqd-error:active { transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-pill); }
    .cqd-download-btn.cqd-loading .cqd-label { opacity: 1; max-width: 110px; margin-left: 12px; }
    .cqd-download-btn.cqd-loading:hover { padding-inline: 12px; border-radius: 20px; transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-pill); }
    .cqd-download-btn.cqd-success { width: 140px; background-color: var(--cqd-color-success); box-shadow: var(--cqd-shadow-success); }
    .cqd-download-btn.cqd-success .cqd-label { opacity: 1; max-width: 110px; margin-left: 8px; }
    .cqd-download-btn.cqd-success:hover { width: 140px; transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-success-strong); }
    .cqd-download-btn.cqd-error { width: 90px; background-color: var(--cqd-color-error); box-shadow: var(--cqd-shadow-error); height: 40px; max-width: 150px; max-height: 40px; padding-top: 0; padding-bottom: 0; align-items: center; transition: all var(--cqd-transition); }
    .cqd-download-btn.cqd-error .cqd-label { opacity: 1; margin-left: 8px; max-width: 110px; overflow: hidden; flex: 0 0 auto; }
    .cqd-error-detail { display: block; font-size: 11px; font-weight: 500; line-height: 1.3; margin-left: 0; margin-top: 0; opacity: 0; max-height: 0; overflow: hidden; white-space: normal; transform: translateY(4px); transition: all var(--cqd-transition); }
    .cqd-download-btn.cqd-error:hover { width: 350px; max-width: 360px; height: 60px; max-height: 61px; padding-top: 8px; padding-bottom: 8px; border-radius: 18px; align-items: center; white-space: normal; gap: 7px; box-shadow: var(--cqd-shadow-error-strong); }
    .cqd-download-btn.cqd-error:hover .cqd-label { opacity: 0; max-width: 0; margin-left: 0; }
    .cqd-download-btn.cqd-error:hover .cqd-error-detail { opacity: 1; max-height: 60px; margin-top: 4px; transform: translateY(0); }
    .cqd-spinner { background-image: none; border-radius: 9999px; width: ${SPINNER_SIZE_PX}px; height: ${SPINNER_SIZE_PX}px; border: 3px solid rgba(255, 255, 255, 0.22); border-top-color: #ffffff; box-shadow: none; animation: cqd-spin 0.65s linear infinite; }
    @keyframes cqd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* ===============================
     * 2. COMMENT FRAME & VERTICAL PILL BADGE
     * =============================== */

    /* The Border Frame */
    .cqd-overlay-container {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none; 
      z-index: 10;
      box-sizing: border-box;
      border-radius: inherit; 
      transition: all 0.2s ease;
      /* Subtle frame glow */
      box-shadow: inset 0 0 0 2px var(--cqd-frame-color), 0 0 12px rgba(99, 102, 241, 0.5);
    }
    
    /* THE BADGE (Vertical Drop) */
    .cqd-comment-badge {
      position: absolute;
      top: 21px; 
      z-index: 9999; /* Always on top */

      display: flex;
      /* VERTICAL STACKING */
      flex-direction: column; 
      align-items: center;
      justify-content: center;
      
      /* Dimensions */
      width: 30px;      
      height: 30px;
      
      background-color: var(--cqd-frame-color);
      color: #ffffff;
      border-radius: 9999px;
      
      cursor: pointer;
      overflow: hidden;
      
      /* Animate Height */
      transition: 
        height var(--cqd-transition),
        box-shadow 0.2s ease;
    }

    /* HOVER STATE: Expands Vertically to show number */
    .cqd-comment-badge:hover {
      height: 58px; /* Enough space for Icon + Number */
    }

    /* --- ATTACHMENT LOGIC (Centering on the border) --- */

    /* LTR (Left Border) */
    body[data-cqd-dir="ltr"] .cqd-comment-badge {
      left: 0;
      transform: translateX(-50%);
    }

    /* RTL (Right Border) */
    body[data-cqd-dir="rtl"] .cqd-comment-badge {
      right: 0; 
      transform: translateX(50%);
    }

    /* ICON */
    .cqd-badge-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      filter: brightness(0) invert(1);
      
      margin-top: 2px;

      /* Ensure icon stays put during transition */
      transition: transform 0.2s ease;
    }

    /* LABEL (The Number) */
    .cqd-badge-label {
      display: block;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 700;
      
      opacity: 0;
      transform: translateY(-5px);

      max-height: 0;
      margin-top: 2px;
      overflow: hidden;

      transition:
        opacity 0.15s ease 0.05s,
        transform 0.15s ease 0.05s,
        max-height 0.15s ease 0.05s,
        margin-top 0.15s ease 0.05s;
      
    }
    
    /* Reveal Number on Hover */
    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;   /* enough for one line of text */
    }
  `.trim();
    (document.head || document.documentElement).appendChild(style);
  }
  const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;
  const INJECTED_ATTR = "data-cqd-injected";
  const RESCAN_INTERVAL_MS = 2e3;
  const RESCAN_DEBOUNCE_MS = 250;
  const LOADING_MIN_MS = 600;
  const FEEDBACK_SUCCESS_MS = 2e3;
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
      scanForAttachments();
    }, RESCAN_DEBOUNCE_MS);
  }
  function setupObservers() {
    if (typeof document === "undefined") return;
    if (!document.body) {
      window.addEventListener("DOMContentLoaded", () => setupObservers(), { once: true });
      return;
    }
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const hasChildListChange = mutations.some(
        (m) => m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0)
      );
      if (hasChildListChange) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(() => scheduleScan(), RESCAN_INTERVAL_MS);
    scheduleScan();
  }
  function scanForAttachments() {
    if (!isGoogleClassroom()) return;
    injectSingleFileButtons();
  }
  function injectSingleFileButtons() {
    const anchors = Array.from(document.querySelectorAll(DRIVE_ANCHOR_SELECTOR));
    for (const anchor of anchors) {
      const url = extractDriveUrlFromAnchor(anchor);
      if (!url) continue;
      const container = anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) || anchor.parentElement || anchor;
      if (!container || hasInjectedButton(container)) continue;
      injectButtonIntoAttachment(container, url);
    }
    const metaElements = Array.from(
      document.querySelectorAll(
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
      return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
    }
    return null;
  }
  function toDownloadUrl(originalUrl, depth = 0) {
    if (depth > 3) return originalUrl;
    try {
      const parsed = new URL(originalUrl, location.href);
      if (parsed.hostname === "drive.google.com") {
        if (parsed.pathname.startsWith("/auth_warmup")) {
          const cont = parsed.searchParams.get("continue");
          if (cont) return toDownloadUrl(cont, depth + 1);
          const id = parsed.searchParams.get("id");
          return id ? `https://drive.google.com/uc?export=download&id=${id}` : originalUrl;
        }
        const fileMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
        if (fileMatch) {
          return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
        }
        if (parsed.pathname === "/open" || parsed.pathname === "/uc") {
          parsed.searchParams.set("export", "download");
          return parsed.toString();
        }
      }
      if (parsed.hostname === "classroom.google.com" && parsed.pathname.startsWith("/drive")) {
        const id = parsed.searchParams.get("id") || parsed.searchParams.get("resourceId") || parsed.searchParams.get("fileId");
        if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
      }
      return originalUrl;
    } catch {
      return originalUrl;
    }
  }
  function cleanAttachmentName(rawName) {
    if (!rawName) return "";
    let name = rawName.trim();
    const garbageLabels = [
      "Microsoft Excel",
      "Microsoft Word",
      "Microsoft PowerPoint",
      "Compressed archive",
      "Binary",
      "Unknown",
      "Google Sheets",
      "Google Docs",
      "Google Slides",
      "Text File",
      "PDF",
      "Video",
      "Image",
      "Audio",
      "Text",
      "Word",
      "Excel",
      "PowerPoint",
      "Archive",
      "Zip",
      "File",
      "Document",
      "Shortcut",
      "Code"
    ];
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
      const firstHalf = name.slice(0, mid);
      const secondHalf = name.slice(mid);
      if (firstHalf === secondHalf) {
        return firstHalf;
      }
    }
    const repeatRegex = /\.([a-zA-Z0-9]{2,10})\1$/i;
    const repeatMatch = name.match(repeatRegex);
    if (repeatMatch) {
      return name.slice(0, -repeatMatch[1].length).trim();
    }
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
    let kind = "other";
    if (ext) {
      switch (ext) {
        // Docs
        case "pdf":
          kind = "pdf";
          break;
        case "doc":
        case "docx":
        case "txt":
        case "rtf":
        case "odt":
        case "md":
        case "tex":
        case "cls":
        case "emlx":
          kind = "doc";
          break;
        case "xls":
        case "xlsx":
        case "csv":
        case "ods":
        case "numbers":
          kind = "sheet";
          break;
        case "ppt":
        case "pptx":
        case "odp":
        case "key":
          kind = "slide";
          break;
        // Media
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
        case "webp":
        case "svg":
        case "bmp":
        case "ico":
        case "avif":
        case "fig":
        case "psd":
        case "ai":
          kind = "image";
          break;
        case "mp4":
        case "mov":
        case "avi":
        case "mkv":
        case "webm":
        case "flv":
        case "wmv":
        case "m4v":
          kind = "video";
          break;
        case "mp3":
        case "wav":
        case "ogg":
        case "m4a":
        case "flac":
        case "aac":
          kind = "audio";
          break;
        // Archives
        case "zip":
        case "rar":
        case "7z":
        case "tar":
        case "gz":
        case "iso":
        case "dmg":
        case "pkg":
        case "mht":
          kind = "archive";
          break;
        // Code / Web
        case "html":
        case "htm":
        case "xml":
        case "css":
        case "js":
        case "ts":
        case "jsx":
        case "tsx":
        case "json":
        case "php":
        case "sql":
        case "py":
        case "c":
        case "cpp":
        case "cs":
        case "java":
        case "rb":
        case "go":
        case "sh":
        case "bat":
        case "ipynb":
        case "pkt":
        case "lock":
        case "yml":
        case "yaml":
          kind = "code";
          break;
        // Fonts
        case "ttf":
        case "otf":
        case "woff":
        case "woff2":
        case "eot":
          kind = "font";
          break;
        // System / Misc
        case "exe":
        case "msi":
        case "apk":
        case "app":
        case "jar":
        case "dll":
        case "pdb":
        case "lnk":
        case "dat":
        case "sqlite":
        case "db":
        case "drawio":
        case "dmp":
          kind = "binary";
          break;
        default:
          kind = "other";
      }
    }
    return { name, ext, kind };
  }
  function injectButtonIntoAttachment(container, url) {
    if (!url) return;
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
    if (button.classList.contains("cqd-success")) return "success";
    if (button.classList.contains("cqd-error")) return "error";
    return "idle";
  }
  function setButtonState(button, state, options) {
    const icon = button.querySelector(".cqd-download-icon");
    const label = button.querySelector(".cqd-label");
    const errorDetail = button.querySelector(".cqd-error-detail");
    if (!icon || !label || !errorDetail) return;
    button.classList.remove("cqd-loading", "cqd-success", "cqd-error");
    icon.classList.remove("cqd-spinner");
    icon.textContent = "";
    button.disabled = false;
    button.style.backgroundColor = "#1a73e8";
    label.textContent = "Download";
    errorDetail.textContent = "";
    icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
    icon.style.backgroundSize = "";
    switch (state) {
      case "idle":
        break;
      case "loading":
        button.classList.add("cqd-loading");
        button.disabled = true;
        label.textContent = "Downloading…";
        icon.classList.add("cqd-spinner");
        icon.style.backgroundImage = "none";
        break;
      case "success":
        button.classList.add("cqd-success");
        button.style.backgroundColor = "#188038";
        label.textContent = "Downloaded";
        icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        break;
      case "error":
        button.classList.add("cqd-error");
        button.style.backgroundColor = "#e05952";
        label.textContent = "Error";
        icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        errorDetail.textContent = options?.userMessage || "Download failed.";
        break;
    }
  }
  function createDownloadButton(_container, url, fileMeta) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqd-download-btn";
    button.setAttribute(INJECTED_ATTR, "true");
    button.setAttribute("aria-label", `Download ${fileMeta.name || "attachment"}`);
    button.setAttribute("title", "Quick download");
    const iconWrapper = document.createElement("span");
    iconWrapper.className = "cqd-icon-wrapper";
    const iconSpan = document.createElement("span");
    iconSpan.className = "cqd-download-icon";
    iconWrapper.appendChild(iconSpan);
    const label = document.createElement("span");
    label.className = "cqd-label";
    label.textContent = "Download";
    const errorDetail = document.createElement("span");
    errorDetail.className = "cqd-error-detail";
    button.appendChild(iconWrapper);
    button.appendChild(label);
    button.appendChild(errorDetail);
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleSingleDownloadClick(button, url, fileMeta);
    });
    return button;
  }
  async function handleSingleDownloadClick(button, url, fileMeta) {
    if (!url) return;
    if (getButtonState(button) !== "idle") return;
    const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
    const startedAt = Date.now();
    setButtonState(button, "loading");
    const startResult = await startBackgroundDownload(requestId, url, fileMeta);
    await ensureMinLoading(startedAt);
    if (!startResult.ok) {
      await showErrorState(button, startResult.userMessage);
      return;
    }
    setButtonState(button, "success");
    await delay(FEEDBACK_SUCCESS_MS);
    if (getButtonState(button) === "success") setButtonState(button, "idle");
  }
  function startBackgroundDownload(requestId, url, fileMeta) {
    const finalUrl = toDownloadUrl(url);
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        resolve({ ok: false, userMessage: "Extension runtime not available." });
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { type: "CQD_DOWNLOAD", url: finalUrl, requestId, fileMeta },
          (response) => {
            if (chrome.runtime.lastError || !response || response.started === false) {
              resolve({ ok: false, userMessage: response?.userMessage || "Could not start download." });
            } else {
              resolve({ ok: true });
            }
          }
        );
      } catch {
        resolve({ ok: false, userMessage: "Extension communication error." });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2luZGV4LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCIvLyBlbnRyeXBvaW50cy9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCJpbXBvcnQgeyBET1dOTE9BRF9JQ09OX1NWR19VUkwgfSBmcm9tICcuL2ljb25zJztcblxuY29uc3QgU1RZTEVfSUQgPSAnY3FkLXN0eWxlJztcbmNvbnN0IFNQSU5ORVJfU0laRV9QWCA9IDE2O1xuXG4vLyBTbW9vdGgsIHNsaWdodGx5IGJvdW5jeSB0cmFuc2l0aW9uIGZvciB0aGUgXCJEcm9wXCIgZmVlbFxuY29uc3QgVFJBTlNJVElPTl9NUyA9IDE1MDtcbmNvbnN0IFRSQU5TSVRJT05fU1RSID0gYCR7VFJBTlNJVElPTl9NU31tcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKWA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIDpyb290IHtcbiAgICAgIC0tY3FkLXRyYW5zaXRpb246ICR7VFJBTlNJVElPTl9TVFJ9O1xuICAgICAgLS1jcWQtY29sb3ItcHJpbWFyeTogIzFhNzNlODtcbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMzNGE4NTM7XG4gICAgICAtLWNxZC1jb2xvci1lcnJvcjogI2UwNTk1MjtcbiAgICAgIC0tY3FkLWZyYW1lLWNvbG9yOiAjNjM2NmYxO1xuXG4gICAgICAtLWNxZC1zaGFkb3ctYmFzZTogMCAwcHggMTBweCByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc2hhZG93LWhvdmVyOiAwIDEwcHggMjRweCByZ2JhKDE1LCAyMywgNDIsIDAuMzApO1xuICAgICAgLS1jcWQtc2hhZG93LXBpbGw6IDAgOHB4IDIycHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzOiAwIDEycHggMjhweCByZ2JhKDI0LCAxMjgsIDU2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNCwgMTI4LCA1NiwgMC43MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjI0LCA4OSwgODIsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyMjQsIDg5LCA4MiwgMC43MCk7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogQ1JJVElDQUwgT1ZFUlJJREVTOiBGb3JjZSBHb29nbGUgQ2FyZCB0byBzaG93IHRoZSBCYWRnZVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIGRpdltkYXRhLXN0cmVhbS1pdGVtLWlkXSB7XG4gICAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICAgIGNvbnRhaW46IG5vbmUgIWltcG9ydGFudDtcbiAgICAgICAgei1pbmRleDogMTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMS4gRVhJU1RJTkcgRE9XTkxPQUQgQlVUVE9OIFNUWUxFUyAoVW5jaGFuZ2VkKVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0biB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDUwJTtcbiAgICAgIHJpZ2h0OiA4cHg7XG4gICAgICB6LWluZGV4OiA1O1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBoZWlnaHQ6IDQwcHg7XG4gICAgICB3aWR0aDogNDBweDtcbiAgICAgIG1heC13aWR0aDogY2FsYygxMDAlIC0gMTZweCk7XG4gICAgICBwYWRkaW5nOiAwO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXByaW1hcnkpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWJhc2UpO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOiB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIHBhZGRpbmctaW5saW5lIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgYm9yZGVyLXJhZGl1cyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBiYWNrZ3JvdW5kLWNvbG9yIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtc3VjY2Vzcyk6bm90KC5jcWQtZXJyb3IpOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAxMjBweDsgcGFkZGluZy1pbmxpbmU6IDEycHg7IGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpOyBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTsgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG4gICAgLmNxZC1kb3dubG9hZC1idG46Zm9jdXMtdmlzaWJsZSB7IG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmOyBvdXRsaW5lLW9mZnNldDogMnB4OyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHsgYm94LXNoYWRvdzogMCAycHggNnB4IHJnYmEoMTUsIDIzLCA0MiwgMC4zKTsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDAuOTcpOyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1pY29uLXdyYXBwZXIgeyBkaXNwbGF5OiBpbmxpbmUtZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IGZsZXgtc2hyaW5rOiAwOyB9XG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrOyB3aWR0aDogMjRweDsgaGVpZ2h0OiAyNHB4OyBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7IGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7IGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjsgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7IGZsZXgtc2hyaW5rOiAwOyB0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJvcmRlci13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuICAgIC5jcWQtaWNvbi1zbWFsbCB7IHdpZHRoOiAxNnB4OyBoZWlnaHQ6IDE2cHg7IGJhY2tncm91bmQtc2l6ZTogMTZweCAxNnB4OyB9XG4gICAgLmNxZC1pY29uLW1lZGl1bSB7IHdpZHRoOiAyNHB4OyBoZWlnaHQ6IDI0cHg7IGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4OyB9XG4gICAgLmNxZC1pY29uLWxhcmdlIHsgd2lkdGg6IDMycHg7IGhlaWdodDogMzJweDsgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWxhYmVsIHsgb3BhY2l0eTogMDsgbWFyZ2luLWxlZnQ6IDA7IG1heC13aWR0aDogMDsgb3ZlcmZsb3c6IGhpZGRlbjsgdHJhbnNpdGlvbjogb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTsgfVxuICAgIC5jcWQtZG93bmxvYWQtYnRuOm5vdCguY3FkLWxvYWRpbmcpOm5vdCguY3FkLWVycm9yKTpub3QoLmNxZC1zdWNjZXNzKTpob3ZlciAuY3FkLWxhYmVsIHsgb3BhY2l0eTogMTsgbWF4LXdpZHRoOiAxMTBweDsgbWFyZ2luLWxlZnQ6IDRweDsgfVxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nLCAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcywgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHsgcGFkZGluZy1pbmxpbmU6IDEycHg7IGJvcmRlci1yYWRpdXM6IDIwcHg7IGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDsgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1waWxsKTsgY3Vyc29yOiBkZWZhdWx0OyB3aWR0aDogMTUwcHg7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTsgfVxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nOmFjdGl2ZSwgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3M6YWN0aXZlLCAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6YWN0aXZlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpOyBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXBpbGwpOyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcgLmNxZC1sYWJlbCB7IG9wYWNpdHk6IDE7IG1heC13aWR0aDogMTEwcHg7IG1hcmdpbi1sZWZ0OiAxMnB4OyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmc6aG92ZXIgeyBwYWRkaW5nLWlubGluZTogMTJweDsgYm9yZGVyLXJhZGl1czogMjBweDsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpOyBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXBpbGwpOyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MgeyB3aWR0aDogMTQwcHg7IGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTsgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1zdWNjZXNzKTsgfVxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwgeyBvcGFjaXR5OiAxOyBtYXgtd2lkdGg6IDExMHB4OyBtYXJnaW4tbGVmdDogOHB4OyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3M6aG92ZXIgeyB3aWR0aDogMTQwcHg7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTsgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZyk7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3IgeyB3aWR0aDogOTBweDsgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTsgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvcik7IGhlaWdodDogNDBweDsgbWF4LXdpZHRoOiAxNTBweDsgbWF4LWhlaWdodDogNDBweDsgcGFkZGluZy10b3A6IDA7IHBhZGRpbmctYm90dG9tOiAwOyBhbGlnbi1pdGVtczogY2VudGVyOyB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pOyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIC5jcWQtbGFiZWwgeyBvcGFjaXR5OiAxOyBtYXJnaW4tbGVmdDogOHB4OyBtYXgtd2lkdGg6IDExMHB4OyBvdmVyZmxvdzogaGlkZGVuOyBmbGV4OiAwIDAgYXV0bzsgfVxuICAgIC5jcWQtZXJyb3ItZGV0YWlsIHsgZGlzcGxheTogYmxvY2s7IGZvbnQtc2l6ZTogMTFweDsgZm9udC13ZWlnaHQ6IDUwMDsgbGluZS1oZWlnaHQ6IDEuMzsgbWFyZ2luLWxlZnQ6IDA7IG1hcmdpbi10b3A6IDA7IG9wYWNpdHk6IDA7IG1heC1oZWlnaHQ6IDA7IG92ZXJmbG93OiBoaWRkZW47IHdoaXRlLXNwYWNlOiBub3JtYWw7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSg0cHgpOyB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pOyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIHsgd2lkdGg6IDM1MHB4OyBtYXgtd2lkdGg6IDM2MHB4OyBoZWlnaHQ6IDYwcHg7IG1heC1oZWlnaHQ6IDYxcHg7IHBhZGRpbmctdG9wOiA4cHg7IHBhZGRpbmctYm90dG9tOiA4cHg7IGJvcmRlci1yYWRpdXM6IDE4cHg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IHdoaXRlLXNwYWNlOiBub3JtYWw7IGdhcDogN3B4OyBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZyk7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1sYWJlbCB7IG9wYWNpdHk6IDA7IG1heC13aWR0aDogMDsgbWFyZ2luLWxlZnQ6IDA7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1lcnJvci1kZXRhaWwgeyBvcGFjaXR5OiAxOyBtYXgtaGVpZ2h0OiA2MHB4OyBtYXJnaW4tdG9wOiA0cHg7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTsgfVxuICAgIC5jcWQtc3Bpbm5lciB7IGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDk5OTlweDsgd2lkdGg6ICR7U1BJTk5FUl9TSVpFX1BYfXB4OyBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4OyBib3JkZXI6IDNweCBzb2xpZCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjIpOyBib3JkZXItdG9wLWNvbG9yOiAjZmZmZmZmOyBib3gtc2hhZG93OiBub25lOyBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTsgfVxuICAgIEBrZXlmcmFtZXMgY3FkLXNwaW4geyBmcm9tIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH0gdG8geyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9IH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAyLiBDT01NRU5UIEZSQU1FICYgVkVSVElDQUwgUElMTCBCQURHRVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuICAgIC8qIFRoZSBCb3JkZXIgRnJhbWUgKi9cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMDsgbGVmdDogMDsgcmlnaHQ6IDA7IGJvdHRvbTogMDtcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lOyBcbiAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IGluaGVyaXQ7IFxuICAgICAgdHJhbnNpdGlvbjogYWxsIDAuMnMgZWFzZTtcbiAgICAgIC8qIFN1YnRsZSBmcmFtZSBnbG93ICovXG4gICAgICBib3gtc2hhZG93OiBpbnNldCAwIDAgMCAycHggdmFyKC0tY3FkLWZyYW1lLWNvbG9yKSwgMCAwIDEycHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNSk7XG4gICAgfVxuICAgIFxuICAgIC8qIFRIRSBCQURHRSAoVmVydGljYWwgRHJvcCkgKi9cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAyMXB4OyBcbiAgICAgIHotaW5kZXg6IDk5OTk7IC8qIEFsd2F5cyBvbiB0b3AgKi9cblxuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIC8qIFZFUlRJQ0FMIFNUQUNLSU5HICovXG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uOyBcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIFxuICAgICAgLyogRGltZW5zaW9ucyAqL1xuICAgICAgd2lkdGg6IDMwcHg7ICAgICAgXG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1mcmFtZS1jb2xvcik7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIFxuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIFxuICAgICAgLyogQW5pbWF0ZSBIZWlnaHQgKi9cbiAgICAgIHRyYW5zaXRpb246IFxuICAgICAgICBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICB9XG5cbiAgICAvKiBIT1ZFUiBTVEFURTogRXhwYW5kcyBWZXJ0aWNhbGx5IHRvIHNob3cgbnVtYmVyICovXG4gICAgLmNxZC1jb21tZW50LWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNThweDsgLyogRW5vdWdoIHNwYWNlIGZvciBJY29uICsgTnVtYmVyICovXG4gICAgfVxuXG4gICAgLyogLS0tIEFUVEFDSE1FTlQgTE9HSUMgKENlbnRlcmluZyBvbiB0aGUgYm9yZGVyKSAtLS0gKi9cblxuICAgIC8qIExUUiAoTGVmdCBCb3JkZXIpICovXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgLyogUlRMIChSaWdodCBCb3JkZXIpICovXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwOyBcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC8qIElDT04gKi9cbiAgICAuY3FkLWJhZGdlLWljb24ge1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogY29udGFpbjtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMCkgaW52ZXJ0KDEpO1xuICAgICAgXG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG5cbiAgICAgIC8qIEVuc3VyZSBpY29uIHN0YXlzIHB1dCBkdXJpbmcgdHJhbnNpdGlvbiAqL1xuICAgICAgdHJhbnNpdGlvbjogdHJhbnNmb3JtIDAuMnMgZWFzZTtcbiAgICB9XG5cbiAgICAvKiBMQUJFTCAoVGhlIE51bWJlcikgKi9cbiAgICAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgXG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01cHgpO1xuXG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMnB4O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcblxuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWF4LWhlaWdodCAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICBtYXJnaW4tdG9wIDAuMTVzIGVhc2UgMC4wNXM7XG4gICAgICBcbiAgICB9XG4gICAgXG4gICAgLyogUmV2ZWFsIE51bWJlciBvbiBIb3ZlciAqL1xuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4OyAgIC8qIGVub3VnaCBmb3Igb25lIGxpbmUgb2YgdGV4dCAqL1xuICAgIH1cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59IiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2luZGV4LnRzXG5jb25zdCBDTEFTU1JPT01fVVJMX1BBVFRFUk4gPSAvXmh0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcLy87XG5cbmltcG9ydCB7XG4gIERPV05MT0FEX0lDT05fU1ZHX1VSTCxcbiAgU1VDQ0VTU19JQ09OX1NWR19VUkwsXG4gIEVSUk9SX0lDT05fU1ZHX1VSTCxcbn0gZnJvbSAnLi9pY29ucyc7XG5cbmltcG9ydCB7IGluamVjdFN0eWxlcyB9IGZyb20gJy4vc3R5bGVzJztcblxuY29uc3QgSU5KRUNURURfQVRUUiA9ICdkYXRhLWNxZC1pbmplY3RlZCc7XG5jb25zdCBSRVNDQU5fSU5URVJWQUxfTVMgPSAyMDAwO1xuY29uc3QgUkVTQ0FOX0RFQk9VTkNFX01TID0gMjUwO1xuY29uc3QgTE9BRElOR19NSU5fTVMgPSA2MDA7XG5jb25zdCBGRUVEQkFDS19TVUNDRVNTX01TID0gMjAwMDtcbmNvbnN0IEZFRURCQUNLX0VSUk9SX01TID0gNDAwMDtcblxuY29uc3QgRFJJVkVfQU5DSE9SX1NFTEVDVE9SID1cbiAgJ2FbaHJlZio9XCJodHRwczovL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCIvL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCJjbGFzc3Jvb20uZ29vZ2xlLmNvbS9kcml2ZVwiXSc7XG5cbmNvbnN0IEFUVEFDSE1FTlRfQ09OVEFJTkVSX1NFTEVDVE9SID0gW1xuICAnLktsUlhkZicsXG4gICcuejN2UmNjJyxcbiAgJy5WZlBwa2QtYVBQNzhlJyxcbiAgJ1tkYXRhLWRyaXZlLWlkXScsXG4gICdbZGF0YS1pZF1bZGF0YS1pdGVtLWlkXScsXG5dLmpvaW4oJywgJyk7XG5cbmNvbnN0IERSSVZFX1VSTF9QQVRURVJOUzogUmVnRXhwW10gPSBbXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL2ZpbGVcXC9kXFwvLyxcbiAgL2h0dHBzOlxcL1xcL2RyaXZlXFwuZ29vZ2xlXFwuY29tXFwvb3BlblxcPy8sXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL3VjXFw/LyxcbiAgL2h0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcL2RyaXZlXFwvLyxcbl07XG5cbmxldCBzY2FuVGltZW91dElkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbmxldCBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlciB8IG51bGwgPSBudWxsO1xuXG50eXBlIEJ1dHRvblN0YXRlID0gJ2lkbGUnIHwgJ2xvYWRpbmcnIHwgJ3N1Y2Nlc3MnIHwgJ2Vycm9yJztcblxudHlwZSBGaWxlTWV0YSA9IHtcbiAgbmFtZT86IHN0cmluZztcbiAgZXh0Pzogc3RyaW5nO1xuICBraW5kPzogc3RyaW5nO1xufTtcblxudHlwZSBQZW5kaW5nQnV0dG9uID0ge1xuICBidXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICByZXF1ZXN0SWQ6IHN0cmluZztcbiAgZmlsZU1ldGE/OiBGaWxlTWV0YTtcbiAgc3RhcnRlZEF0OiBudW1iZXI7XG59O1xuXG5sZXQgbmV4dFJlcXVlc3RTZXEgPSAxO1xuY29uc3QgcGVuZGluZ0J1dHRvbnMgPSBuZXcgTWFwPHN0cmluZywgUGVuZGluZ0J1dHRvbj4oKTtcblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEVudmlyb25tZW50IC8gUGFnZSBDaGVja3NcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGlzR29vZ2xlQ2xhc3Nyb29tKCk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIGxvY2F0aW9uID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICBpZiAobG9jYXRpb24uaG9zdG5hbWUgIT09ICdjbGFzc3Jvb20uZ29vZ2xlLmNvbScpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIENMQVNTUk9PTV9VUkxfUEFUVEVSTi50ZXN0KGxvY2F0aW9uLmhyZWYpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogU2Nhbm5pbmcgLyBPYnNlcnZlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHNjaGVkdWxlU2NhbigpOiB2b2lkIHtcbiAgaWYgKHNjYW5UaW1lb3V0SWQgIT09IG51bGwpIHtcbiAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHNjYW5UaW1lb3V0SWQpO1xuICB9XG4gIHNjYW5UaW1lb3V0SWQgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgc2NhblRpbWVvdXRJZCA9IG51bGw7XG4gICAgc2NhbkZvckF0dGFjaG1lbnRzKCk7XG4gIH0sIFJFU0NBTl9ERUJPVU5DRV9NUyk7XG59XG5cbmZ1bmN0aW9uIHNldHVwT2JzZXJ2ZXJzKCk6IHZvaWQge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICBpZiAoIWRvY3VtZW50LmJvZHkpIHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHNldHVwT2JzZXJ2ZXJzKCksIHsgb25jZTogdHJ1ZSB9KTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG9ic2VydmVyKSByZXR1cm47XG5cbiAgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgY29uc3QgaGFzQ2hpbGRMaXN0Q2hhbmdlID0gbXV0YXRpb25zLnNvbWUoXG4gICAgICAobSkgPT4gbS50eXBlID09PSAnY2hpbGRMaXN0JyAmJiAobS5hZGRlZE5vZGVzLmxlbmd0aCA+IDAgfHwgbS5yZW1vdmVkTm9kZXMubGVuZ3RoID4gMCksXG4gICAgKTtcbiAgICBpZiAoaGFzQ2hpbGRMaXN0Q2hhbmdlKSBzY2hlZHVsZVNjYW4oKTtcbiAgfSk7XG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XG4gIHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiBzY2hlZHVsZVNjYW4oKSwgUkVTQ0FOX0lOVEVSVkFMX01TKTtcbiAgc2NoZWR1bGVTY2FuKCk7XG59XG5cbmZ1bmN0aW9uIHNjYW5Gb3JBdHRhY2htZW50cygpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGluamVjdFNpbmdsZUZpbGVCdXR0b25zKCk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBTaW5nbGUtZmlsZSBidXR0b25zXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbmplY3RTaW5nbGVGaWxlQnV0dG9ucygpOiB2b2lkIHtcbiAgY29uc3QgYW5jaG9ycyA9IEFycmF5LmZyb20oZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MQW5jaG9yRWxlbWVudD4oRFJJVkVfQU5DSE9SX1NFTEVDVE9SKSk7XG4gIGZvciAoY29uc3QgYW5jaG9yIG9mIGFuY2hvcnMpIHtcbiAgICBjb25zdCB1cmwgPSBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKGFuY2hvcik7XG4gICAgaWYgKCF1cmwpIGNvbnRpbnVlO1xuICAgIGNvbnN0IGNvbnRhaW5lciA9XG4gICAgICAoYW5jaG9yLmNsb3Nlc3QoQVRUQUNITUVOVF9DT05UQUlORVJfU0VMRUNUT1IpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCkgfHxcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50IHx8XG4gICAgICBhbmNob3I7XG4gICAgaWYgKCFjb250YWluZXIgfHwgaGFzSW5qZWN0ZWRCdXR0b24oY29udGFpbmVyKSkgY29udGludWU7XG4gICAgaW5qZWN0QnV0dG9uSW50b0F0dGFjaG1lbnQoY29udGFpbmVyLCB1cmwpO1xuICB9XG5cbiAgY29uc3QgbWV0YUVsZW1lbnRzID0gQXJyYXkuZnJvbShcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICAgICdbZGF0YS1kcml2ZS1pZF0sIFtkYXRhLWlkXVtkYXRhLWl0ZW0taWRdLCBbZGF0YS1pZF1bZGF0YS10b29sdGlwXScsXG4gICAgKSxcbiAgKTtcbiAgZm9yIChjb25zdCBlbCBvZiBtZXRhRWxlbWVudHMpIHtcbiAgICBpZiAoaGFzSW5qZWN0ZWRCdXR0b24oZWwpKSBjb250aW51ZTtcbiAgICBjb25zdCB1cmwgPSBmaW5kRHJpdmVVcmwoZWwpO1xuICAgIGlmICghdXJsKSBjb250aW51ZTtcbiAgICBpbmplY3RCdXR0b25JbnRvQXR0YWNobWVudChlbCwgdXJsKTtcbiAgfVxufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogVVJMIC8gRE9NIEhlbHBlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGhhc0luamVjdGVkQnV0dG9uKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBib29sZWFuIHtcbiAgcmV0dXJuICEhY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoYFske0lOSkVDVEVEX0FUVFJ9PVwidHJ1ZVwiXWApO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKGFuY2hvcjogSFRNTEFuY2hvckVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgaHJlZiA9IGFuY2hvci5ocmVmO1xuICBpZiAoIWhyZWYpIHJldHVybiBudWxsO1xuICByZXR1cm4gRFJJVkVfVVJMX1BBVFRFUk5TLnNvbWUoKHJlKSA9PiByZS50ZXN0KGhyZWYpKSA/IGhyZWYgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kRHJpdmVVcmwoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgbmVhckFuY2hvciA9XG4gICAgZWxlbWVudC5xdWVyeVNlbGVjdG9yPEhUTUxBbmNob3JFbGVtZW50PihEUklWRV9BTkNIT1JfU0VMRUNUT1IpIHx8XG4gICAgKGVsZW1lbnQuY2xvc2VzdChEUklWRV9BTkNIT1JfU0VMRUNUT1IpIGFzIEhUTUxBbmNob3JFbGVtZW50IHwgbnVsbCk7XG5cbiAgaWYgKG5lYXJBbmNob3IpIHtcbiAgICBjb25zdCBocmVmID0gZXh0cmFjdERyaXZlVXJsRnJvbUFuY2hvcihuZWFyQW5jaG9yKTtcbiAgICBpZiAoaHJlZikgcmV0dXJuIGhyZWY7XG4gIH1cblxuICBjb25zdCBkcml2ZUlkID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZHJpdmUtaWQnKSB8fCBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1pZCcpO1xuICBpZiAoZHJpdmVJZCkge1xuICAgIHJldHVybiBgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL3VjP2V4cG9ydD1kb3dubG9hZCZpZD0ke2VuY29kZVVSSUNvbXBvbmVudChkcml2ZUlkKX1gO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiB0b0Rvd25sb2FkVXJsKG9yaWdpbmFsVXJsOiBzdHJpbmcsIGRlcHRoID0gMCk6IHN0cmluZyB7XG4gIGlmIChkZXB0aCA+IDMpIHJldHVybiBvcmlnaW5hbFVybDtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXJzZWQgPSBuZXcgVVJMKG9yaWdpbmFsVXJsLCBsb2NhdGlvbi5ocmVmKTtcbiAgICBpZiAocGFyc2VkLmhvc3RuYW1lID09PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHtcbiAgICAgIGlmIChwYXJzZWQucGF0aG5hbWUuc3RhcnRzV2l0aCgnL2F1dGhfd2FybXVwJykpIHtcbiAgICAgICAgY29uc3QgY29udCA9IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdjb250aW51ZScpO1xuICAgICAgICBpZiAoY29udCkgcmV0dXJuIHRvRG93bmxvYWRVcmwoY29udCwgZGVwdGggKyAxKTtcbiAgICAgICAgY29uc3QgaWQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnaWQnKTtcbiAgICAgICAgcmV0dXJuIGlkID8gYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtpZH1gIDogb3JpZ2luYWxVcmw7XG4gICAgICB9XG4gICAgICBjb25zdCBmaWxlTWF0Y2ggPSBwYXJzZWQucGF0aG5hbWUubWF0Y2goL15cXC9maWxlXFwvZFxcLyhbXi9dKykvKTtcbiAgICAgIGlmIChmaWxlTWF0Y2gpIHtcbiAgICAgICAgcmV0dXJuIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZmlsZU1hdGNoWzFdfWA7XG4gICAgICB9XG4gICAgICBpZiAocGFyc2VkLnBhdGhuYW1lID09PSAnL29wZW4nIHx8IHBhcnNlZC5wYXRobmFtZSA9PT0gJy91YycpIHtcbiAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5zZXQoJ2V4cG9ydCcsICdkb3dubG9hZCcpO1xuICAgICAgICByZXR1cm4gcGFyc2VkLnRvU3RyaW5nKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwYXJzZWQuaG9zdG5hbWUgPT09ICdjbGFzc3Jvb20uZ29vZ2xlLmNvbScgJiYgcGFyc2VkLnBhdGhuYW1lLnN0YXJ0c1dpdGgoJy9kcml2ZScpKSB7XG4gICAgICAgY29uc3QgaWQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnaWQnKSB8fCBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgncmVzb3VyY2VJZCcpIHx8IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdmaWxlSWQnKTtcbiAgICAgICBpZiAoaWQpIHJldHVybiBgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL3VjP2V4cG9ydD1kb3dubG9hZCZpZD0ke2lkfWA7XG4gICAgfVxuICAgIHJldHVybiBvcmlnaW5hbFVybDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG9yaWdpbmFsVXJsO1xuICB9XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBGaWxlIG1ldGFkYXRhIGV4dHJhY3Rpb24gKFVuaXZlcnNhbCBTdXBwb3J0KVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuLyoqXG4gKiDwn5qAIEZJWEVEIENMRUFORVI6IEhhbmRsZXMgTmFtZSArIE5hbWUgKyBMYWJlbFxuICogT3JkZXIgb2Ygb3BlcmF0aW9uczpcbiAqIDEuIFJlbW92ZSBnYXJiYWdlIGxhYmVscyAoXCJNaWNyb3NvZnQgRXhjZWxcIiwgXCJCaW5hcnlcIiwgXCJVbmtub3duXCIpXG4gKiAyLiBUSEVOIGNoZWNrIGZvciBmdWxsIHN0cmluZyBkdXBsaWNhdGlvbiAoXCJpbml0LnBocGluaXQucGhwXCIpXG4gKiAzLiBUSEVOIGNoZWNrIGZvciBzdWZmaXggZHVwbGljYXRpb24gKFwiZmlsZS5wZGZQREZcIilcbiAqL1xuZnVuY3Rpb24gY2xlYW5BdHRhY2htZW50TmFtZShyYXdOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIXJhd05hbWUpIHJldHVybiAnJztcbiAgbGV0IG5hbWUgPSByYXdOYW1lLnRyaW0oKTtcblxuICAvLyAxLiBMQUJFTCBDTEVBTlVQIChNdXN0IGJlIGZpcnN0IHRvIGV4cG9zZSB0aGUgZHVwbGljYXRpb24pXG4gIC8vIExvbmdlc3QgbGFiZWxzIGZpcnN0IHRvIGF2b2lkIHBhcnRpYWwgbWF0Y2hlcyAoZS5nLiBcIk1pY3Jvc29mdCBFeGNlbFwiIGJlZm9yZSBcIkV4Y2VsXCIpXG4gIGNvbnN0IGdhcmJhZ2VMYWJlbHMgPSBbXG4gICAgJ01pY3Jvc29mdCBFeGNlbCcsICdNaWNyb3NvZnQgV29yZCcsICdNaWNyb3NvZnQgUG93ZXJQb2ludCcsICdDb21wcmVzc2VkIGFyY2hpdmUnLCBcbiAgICAnQmluYXJ5JywgJ1Vua25vd24nLCAnR29vZ2xlIFNoZWV0cycsICdHb29nbGUgRG9jcycsICdHb29nbGUgU2xpZGVzJywgJ1RleHQgRmlsZScsXG4gICAgJ1BERicsICdWaWRlbycsICdJbWFnZScsICdBdWRpbycsICdUZXh0JywgJ1dvcmQnLCAnRXhjZWwnLCAnUG93ZXJQb2ludCcsIFxuICAgICdBcmNoaXZlJywgJ1ppcCcsICdGaWxlJywgJ0RvY3VtZW50JywgJ1Nob3J0Y3V0JywgJ0NvZGUnXG4gIF07XG5cbiAgZm9yIChjb25zdCBsYWJlbCBvZiBnYXJiYWdlTGFiZWxzKSB7XG4gICAgaWYgKG5hbWUuZW5kc1dpdGgobGFiZWwpKSB7XG4gICAgICAvLyBUcnkgc3RyaXBwaW5nIGl0XG4gICAgICBjb25zdCBwb3RlbnRpYWwgPSBuYW1lLnNsaWNlKDAsIC1sYWJlbC5sZW5ndGgpLnRyaW0oKTtcbiAgICAgIFxuICAgICAgLy8gT25seSBhY2NlcHQgdGhlIHN0cmlwIGlmIHdlIGFyZW4ndCBsZWZ0IHdpdGggYW4gZW1wdHkgc3RyaW5nXG4gICAgICBpZiAocG90ZW50aWFsLmxlbmd0aCA+IDApIHtcbiAgICAgICAgIG5hbWUgPSBwb3RlbnRpYWw7XG4gICAgICAgICAvLyBXZSBicmVhayBhZnRlciB0aGUgZmlyc3QgbWF0Y2ggdG8gYXZvaWQgb3Zlci1zdHJpcHBpbmcgXG4gICAgICAgICAvLyAoZS5nLiBcIkZpbGUgRmlsZVwiIC0+IFwiRmlsZVwiKSB1bmxlc3MgeW91ciBVSSBzdGFja3MgdGhlbSwgXG4gICAgICAgICAvLyBidXQgdXN1YWxseSBpdCdzIGp1c3Qgb25lIGxhYmVsLlxuICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gMi4gRVhBQ1QgSEFMRiBTUExJVCAoVGhlIFwiaW5pdC5waHBpbml0LnBocFwiIG9yIFwiSGFzaE1hcEhhc2hNYXBcIiBGaXgpXG4gIC8vIE5vdyB0aGF0IFwiQmluYXJ5XCIgaXMgZ29uZSwgXCJIYXNoTWFwSGFzaE1hcFwiIHdpbGwgYmUgc3BsaXQgY29ycmVjdGx5LlxuICBpZiAobmFtZS5sZW5ndGggPiAwICYmIG5hbWUubGVuZ3RoICUgMiA9PT0gMCkge1xuICAgIGNvbnN0IG1pZCA9IG5hbWUubGVuZ3RoIC8gMjtcbiAgICBjb25zdCBmaXJzdEhhbGYgPSBuYW1lLnNsaWNlKDAsIG1pZCk7XG4gICAgY29uc3Qgc2Vjb25kSGFsZiA9IG5hbWUuc2xpY2UobWlkKTtcbiAgICBpZiAoZmlyc3RIYWxmID09PSBzZWNvbmRIYWxmKSB7XG4gICAgICAgcmV0dXJuIGZpcnN0SGFsZjtcbiAgICB9XG4gIH1cblxuICAvLyAzLiBSRUdFWCBTVUZGSVggUkVQRUFUIChUaGUgXCJmaWxlLnBkZlBERlwiIEZpeClcbiAgY29uc3QgcmVwZWF0UmVnZXggPSAvXFwuKFthLXpBLVowLTldezIsMTB9KVxcMSQvaTtcbiAgY29uc3QgcmVwZWF0TWF0Y2ggPSBuYW1lLm1hdGNoKHJlcGVhdFJlZ2V4KTtcbiAgaWYgKHJlcGVhdE1hdGNoKSB7XG4gICAgICByZXR1cm4gbmFtZS5zbGljZSgwLCAtcmVwZWF0TWF0Y2hbMV0ubGVuZ3RoKS50cmltKCk7XG4gIH1cblxuICByZXR1cm4gbmFtZTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEZpbGVNZXRhKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHVybDogc3RyaW5nKTogRmlsZU1ldGEge1xuICBsZXQgbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0IHRvb2x0aXAgPVxuICAgIGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2RhdGEtdG9vbHRpcCcpIHx8XG4gICAgY29udGFpbmVyLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpIHx8XG4gICAgY29udGFpbmVyLmdldEF0dHJpYnV0ZSgndGl0bGUnKTtcbiAgXG4gIGlmICh0b29sdGlwICYmIHRvb2x0aXAudHJpbSgpKSBuYW1lID0gdG9vbHRpcC50cmltKCk7XG5cbiAgaWYgKCFuYW1lKSB7XG4gICAgY29uc3QgdGV4dCA9IChjb250YWluZXIudGV4dENvbnRlbnQgfHwgJycpLnRyaW0oKTtcbiAgICBpZiAodGV4dCkge1xuICAgICAgY29uc3QgbGluZXMgPSB0ZXh0LnNwbGl0KCdcXG4nKS5tYXAoKGwpID0+IGwudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAobGluZXMubGVuZ3RoID4gMCkgbmFtZSA9IGxpbmVzWzBdO1xuICAgIH1cbiAgfVxuXG4gIGlmICghbmFtZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB1ID0gbmV3IFVSTCh1cmwpO1xuICAgICAgY29uc3QgcGF0aE5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQodS5wYXRobmFtZS5zcGxpdCgnLycpLnBvcCgpIHx8ICcnKTtcbiAgICAgIGlmIChwYXRoTmFtZSAmJiBwYXRoTmFtZS5pbmNsdWRlcygnLicpKSBuYW1lID0gcGF0aE5hbWU7XG4gICAgfSBjYXRjaCB7fVxuICB9XG5cbiAgLy8g8J+nuSBBcHBseSB0aGUgbmV3IGxvZ2ljXG4gIGlmIChuYW1lKSBuYW1lID0gY2xlYW5BdHRhY2htZW50TmFtZShuYW1lKTtcblxuICAvLyDwn5SNIEV4dHJhY3QgRXh0ZW5zaW9uXG4gIGxldCBleHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgaWYgKG5hbWUpIHtcbiAgICBjb25zdCBtID0gbmFtZS5tYXRjaCgvXFwuKFthLXpBLVowLTldezIsMTB9KSQvKTsgXG4gICAgaWYgKG0pIGV4dCA9IG1bMV0udG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIC8vIPCfk4IgRGV0ZXJtaW5lIEtpbmQgKEZ1bGx5IGV4cGFuZGVkIGZvciB5b3VyIGxpc3QpXG4gIGxldCBraW5kOiBzdHJpbmcgPSAnb3RoZXInO1xuICBpZiAoZXh0KSB7XG4gICAgc3dpdGNoIChleHQpIHtcbiAgICAgIC8vIERvY3NcbiAgICAgIGNhc2UgJ3BkZic6IGtpbmQgPSAncGRmJzsgYnJlYWs7XG4gICAgICBjYXNlICdkb2MnOiBjYXNlICdkb2N4JzogY2FzZSAndHh0JzogY2FzZSAncnRmJzogY2FzZSAnb2R0JzogY2FzZSAnbWQnOiBjYXNlICd0ZXgnOiBjYXNlICdjbHMnOiBjYXNlICdlbWx4Jzoga2luZCA9ICdkb2MnOyBicmVhaztcbiAgICAgIGNhc2UgJ3hscyc6IGNhc2UgJ3hsc3gnOiBjYXNlICdjc3YnOiBjYXNlICdvZHMnOiBjYXNlICdudW1iZXJzJzoga2luZCA9ICdzaGVldCc7IGJyZWFrO1xuICAgICAgY2FzZSAncHB0JzogY2FzZSAncHB0eCc6IGNhc2UgJ29kcCc6IGNhc2UgJ2tleSc6IGtpbmQgPSAnc2xpZGUnOyBicmVhaztcbiAgICAgIFxuICAgICAgLy8gTWVkaWFcbiAgICAgIGNhc2UgJ2pwZyc6IGNhc2UgJ2pwZWcnOiBjYXNlICdwbmcnOiBjYXNlICdnaWYnOiBjYXNlICd3ZWJwJzogY2FzZSAnc3ZnJzogY2FzZSAnYm1wJzogY2FzZSAnaWNvJzogY2FzZSAnYXZpZic6IGNhc2UgJ2ZpZyc6IGNhc2UgJ3BzZCc6IGNhc2UgJ2FpJzoga2luZCA9ICdpbWFnZSc7IGJyZWFrO1xuICAgICAgY2FzZSAnbXA0JzogY2FzZSAnbW92JzogY2FzZSAnYXZpJzogY2FzZSAnbWt2JzogY2FzZSAnd2VibSc6IGNhc2UgJ2Zsdic6IGNhc2UgJ3dtdic6IGNhc2UgJ200dic6IGtpbmQgPSAndmlkZW8nOyBicmVhaztcbiAgICAgIGNhc2UgJ21wMyc6IGNhc2UgJ3dhdic6IGNhc2UgJ29nZyc6IGNhc2UgJ200YSc6IGNhc2UgJ2ZsYWMnOiBjYXNlICdhYWMnOiBraW5kID0gJ2F1ZGlvJzsgYnJlYWs7XG4gICAgICBcbiAgICAgIC8vIEFyY2hpdmVzXG4gICAgICBjYXNlICd6aXAnOiBjYXNlICdyYXInOiBjYXNlICc3eic6IGNhc2UgJ3Rhcic6IGNhc2UgJ2d6JzogY2FzZSAnaXNvJzogY2FzZSAnZG1nJzogY2FzZSAncGtnJzogY2FzZSAnbWh0Jzoga2luZCA9ICdhcmNoaXZlJzsgYnJlYWs7XG4gICAgICBcbiAgICAgIC8vIENvZGUgLyBXZWJcbiAgICAgIGNhc2UgJ2h0bWwnOiBjYXNlICdodG0nOiBjYXNlICd4bWwnOiBjYXNlICdjc3MnOiBjYXNlICdqcyc6IGNhc2UgJ3RzJzogY2FzZSAnanN4JzogY2FzZSAndHN4JzogY2FzZSAnanNvbic6IGNhc2UgJ3BocCc6IGNhc2UgJ3NxbCc6IGNhc2UgJ3B5JzogY2FzZSAnYyc6IGNhc2UgJ2NwcCc6IGNhc2UgJ2NzJzogY2FzZSAnamF2YSc6IGNhc2UgJ3JiJzogY2FzZSAnZ28nOiBjYXNlICdzaCc6IGNhc2UgJ2JhdCc6IGNhc2UgJ2lweW5iJzogY2FzZSAncGt0JzogY2FzZSAnbG9jayc6IGNhc2UgJ3ltbCc6IGNhc2UgJ3lhbWwnOiBraW5kID0gJ2NvZGUnOyBicmVhaztcbiAgICAgIFxuICAgICAgLy8gRm9udHNcbiAgICAgIGNhc2UgJ3R0Zic6IGNhc2UgJ290Zic6IGNhc2UgJ3dvZmYnOiBjYXNlICd3b2ZmMic6IGNhc2UgJ2VvdCc6IGtpbmQgPSAnZm9udCc7IGJyZWFrO1xuXG4gICAgICAvLyBTeXN0ZW0gLyBNaXNjXG4gICAgICBjYXNlICdleGUnOiBjYXNlICdtc2knOiBjYXNlICdhcGsnOiBjYXNlICdhcHAnOiBjYXNlICdqYXInOiBjYXNlICdkbGwnOiBjYXNlICdwZGInOiBjYXNlICdsbmsnOiBjYXNlICdkYXQnOiBjYXNlICdzcWxpdGUnOiBjYXNlICdkYic6IGNhc2UgJ2RyYXdpbyc6IGNhc2UgJ2RtcCc6IGtpbmQgPSAnYmluYXJ5JzsgYnJlYWs7XG4gICAgICBcbiAgICAgIGRlZmF1bHQ6IGtpbmQgPSAnb3RoZXInO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IG5hbWUsIGV4dCwga2luZCB9O1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQnV0dG9uIGluamVjdGlvblxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaW5qZWN0QnV0dG9uSW50b0F0dGFjaG1lbnQoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdXJsOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKCF1cmwpIHJldHVybjtcbiAgY29uc3QgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShjb250YWluZXIpO1xuICBpZiAoY29tcHV0ZWQucG9zaXRpb24gPT09ICdzdGF0aWMnKSBjb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXG4gIGNvbnN0IGRpcmVjdFVybCA9IHRvRG93bmxvYWRVcmwodXJsKTtcbiAgY29uc3QgZmlsZU1ldGEgPSBleHRyYWN0RmlsZU1ldGEoY29udGFpbmVyLCBkaXJlY3RVcmwpO1xuICBjb25zdCBidXR0b24gPSBjcmVhdGVEb3dubG9hZEJ1dHRvbihjb250YWluZXIsIGRpcmVjdFVybCwgZmlsZU1ldGEpO1xuXG4gIGNvbnN0IGljb25FbCA9IGJ1dHRvbi5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kb3dubG9hZC1pY29uJyk7XG4gIGlmIChpY29uRWwpIGljb25FbC5jbGFzc0xpc3QuYWRkKCdjcWQtaWNvbi1tZWRpdW0nKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKGJ1dHRvbik7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gc3RhdGUgaGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gZ2V0QnV0dG9uU3RhdGUoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCk6IEJ1dHRvblN0YXRlIHtcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykpIHJldHVybiAnbG9hZGluZyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtc3VjY2VzcycpKSByZXR1cm4gJ3N1Y2Nlc3MnO1xuICBpZiAoYnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnY3FkLWVycm9yJykpIHJldHVybiAnZXJyb3InO1xuICByZXR1cm4gJ2lkbGUnO1xufVxuXG5mdW5jdGlvbiBzZXRCdXR0b25TdGF0ZShidXR0b246IEhUTUxCdXR0b25FbGVtZW50LCBzdGF0ZTogQnV0dG9uU3RhdGUsIG9wdGlvbnM/OiB7IHVzZXJNZXNzYWdlPzogc3RyaW5nIH0pOiB2b2lkIHtcbiAgY29uc3QgaWNvbiA9IGJ1dHRvbi5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kb3dubG9hZC1pY29uJyk7XG4gIGNvbnN0IGxhYmVsID0gYnV0dG9uLnF1ZXJ5U2VsZWN0b3I8SFRNTFNwYW5FbGVtZW50PignLmNxZC1sYWJlbCcpO1xuICBjb25zdCBlcnJvckRldGFpbCA9IGJ1dHRvbi5xdWVyeVNlbGVjdG9yPEhUTUxTcGFuRWxlbWVudD4oJy5jcWQtZXJyb3ItZGV0YWlsJyk7XG4gIGlmICghaWNvbiB8fCAhbGFiZWwgfHwgIWVycm9yRGV0YWlsKSByZXR1cm47XG5cbiAgYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1sb2FkaW5nJywgJ2NxZC1zdWNjZXNzJywgJ2NxZC1lcnJvcicpO1xuICBpY29uLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1zcGlubmVyJyk7XG4gIGljb24udGV4dENvbnRlbnQgPSAnJztcbiAgYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnIzFhNzNlOCc7XG4gIGxhYmVsLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkJztcbiAgZXJyb3JEZXRhaWwudGV4dENvbnRlbnQgPSAnJztcblxuICBpY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIilgO1xuICBpY29uLnN0eWxlLmJhY2tncm91bmRTaXplID0gJyc7XG5cbiAgc3dpdGNoIChzdGF0ZSkge1xuICAgIGNhc2UgJ2lkbGUnOiBicmVhaztcbiAgICBjYXNlICdsb2FkaW5nJzpcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtbG9hZGluZycpO1xuICAgICAgYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkaW5n4oCmJztcbiAgICAgIGljb24uY2xhc3NMaXN0LmFkZCgnY3FkLXNwaW5uZXInKTtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJ25vbmUnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnc3VjY2Vzcyc6XG4gICAgICBidXR0b24uY2xhc3NMaXN0LmFkZCgnY3FkLXN1Y2Nlc3MnKTtcbiAgICAgIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnIzE4ODAzOCc7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9ICdEb3dubG9hZGVkJztcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7U1VDQ0VTU19JQ09OX1NWR19VUkx9XCIpYDtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZFNpemUgPSAnMjBweCAyMHB4JztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtZXJyb3InKTtcbiAgICAgIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnI2UwNTk1Mic7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9ICdFcnJvcic7XG4gICAgICBpY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGB1cmwoXCIke0VSUk9SX0lDT05fU1ZHX1VSTH1cIilgO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kU2l6ZSA9ICcyMHB4IDIwcHgnO1xuICAgICAgZXJyb3JEZXRhaWwudGV4dENvbnRlbnQgPSBvcHRpb25zPy51c2VyTWVzc2FnZSB8fCAnRG93bmxvYWQgZmFpbGVkLic7XG4gICAgICBicmVhaztcbiAgfVxufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQnV0dG9uIGZhY3RvcnlcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGNyZWF0ZURvd25sb2FkQnV0dG9uKF9jb250YWluZXI6IEhUTUxFbGVtZW50LCB1cmw6IHN0cmluZywgZmlsZU1ldGE6IEZpbGVNZXRhKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgYnV0dG9uLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYnRuJztcbiAgYnV0dG9uLnNldEF0dHJpYnV0ZShJTkpFQ1RFRF9BVFRSLCAndHJ1ZScpO1xuICBidXR0b24uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYERvd25sb2FkICR7ZmlsZU1ldGEubmFtZSB8fCAnYXR0YWNobWVudCd9YCk7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ1F1aWNrIGRvd25sb2FkJyk7XG5cbiAgY29uc3QgaWNvbldyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGljb25XcmFwcGVyLmNsYXNzTmFtZSA9ICdjcWQtaWNvbi13cmFwcGVyJztcbiAgY29uc3QgaWNvblNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGljb25TcGFuLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtaWNvbic7XG4gIGljb25XcmFwcGVyLmFwcGVuZENoaWxkKGljb25TcGFuKTtcblxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NxZC1sYWJlbCc7XG4gIGxhYmVsLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkJztcbiAgY29uc3QgZXJyb3JEZXRhaWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGVycm9yRGV0YWlsLmNsYXNzTmFtZSA9ICdjcWQtZXJyb3ItZGV0YWlsJztcblxuICBidXR0b24uYXBwZW5kQ2hpbGQoaWNvbldyYXBwZXIpO1xuICBidXR0b24uYXBwZW5kQ2hpbGQobGFiZWwpO1xuICBidXR0b24uYXBwZW5kQ2hpbGQoZXJyb3JEZXRhaWwpO1xuXG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGF3YWl0IGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soYnV0dG9uLCB1cmwsIGZpbGVNZXRhKTtcbiAgfSk7XG4gIHJldHVybiBidXR0b247XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCwgdXJsOiBzdHJpbmcsIGZpbGVNZXRhOiBGaWxlTWV0YSk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIXVybCkgcmV0dXJuO1xuICBpZiAoZ2V0QnV0dG9uU3RhdGUoYnV0dG9uKSAhPT0gJ2lkbGUnKSByZXR1cm47XG5cbiAgY29uc3QgcmVxdWVzdElkID0gYGNxZC0ke0RhdGUubm93KCl9LSR7bmV4dFJlcXVlc3RTZXErK31gO1xuICBjb25zdCBzdGFydGVkQXQgPSBEYXRlLm5vdygpO1xuICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdsb2FkaW5nJyk7XG5cbiAgY29uc3Qgc3RhcnRSZXN1bHQgPSBhd2FpdCBzdGFydEJhY2tncm91bmREb3dubG9hZChyZXF1ZXN0SWQsIHVybCwgZmlsZU1ldGEpO1xuICBhd2FpdCBlbnN1cmVNaW5Mb2FkaW5nKHN0YXJ0ZWRBdCk7XG5cbiAgaWYgKCFzdGFydFJlc3VsdC5vaykge1xuICAgIGF3YWl0IHNob3dFcnJvclN0YXRlKGJ1dHRvbiwgc3RhcnRSZXN1bHQudXNlck1lc3NhZ2UpO1xuICAgIHJldHVybjtcbiAgfVxuICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdzdWNjZXNzJyk7XG4gIGF3YWl0IGRlbGF5KEZFRURCQUNLX1NVQ0NFU1NfTVMpO1xuICBpZiAoZ2V0QnV0dG9uU3RhdGUoYnV0dG9uKSA9PT0gJ3N1Y2Nlc3MnKSBzZXRCdXR0b25TdGF0ZShidXR0b24sICdpZGxlJyk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0QmFja2dyb3VuZERvd25sb2FkKHJlcXVlc3RJZDogc3RyaW5nLCB1cmw6IHN0cmluZywgZmlsZU1ldGE6IEZpbGVNZXRhKTogUHJvbWlzZTx7IG9rOiBib29sZWFuOyB1c2VyTWVzc2FnZT86IHN0cmluZyB9PiB7XG4gIGNvbnN0IGZpbmFsVXJsID0gdG9Eb3dubG9hZFVybCh1cmwpO1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBpZiAodHlwZW9mIGNocm9tZSA9PT0gJ3VuZGVmaW5lZCcgfHwgIWNocm9tZS5ydW50aW1lPy5zZW5kTWVzc2FnZSkge1xuICAgICAgcmVzb2x2ZSh7IG9rOiBmYWxzZSwgdXNlck1lc3NhZ2U6ICdFeHRlbnNpb24gcnVudGltZSBub3QgYXZhaWxhYmxlLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShcbiAgICAgICAgeyB0eXBlOiAnQ1FEX0RPV05MT0FEJywgdXJsOiBmaW5hbFVybCwgcmVxdWVzdElkLCBmaWxlTWV0YSB9LFxuICAgICAgICAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yIHx8ICFyZXNwb25zZSB8fCByZXNwb25zZS5zdGFydGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgcmVzb2x2ZSh7IG9rOiBmYWxzZSwgdXNlck1lc3NhZ2U6IHJlc3BvbnNlPy51c2VyTWVzc2FnZSB8fCAnQ291bGQgbm90IHN0YXJ0IGRvd25sb2FkLicgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc29sdmUoeyBvazogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXNvbHZlKHsgb2s6IGZhbHNlLCB1c2VyTWVzc2FnZTogJ0V4dGVuc2lvbiBjb21tdW5pY2F0aW9uIGVycm9yLicgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFVJIFV0aWxzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5hc3luYyBmdW5jdGlvbiBzaG93RXJyb3JTdGF0ZShidXR0b246IEhUTUxCdXR0b25FbGVtZW50LCB1c2VyTWVzc2FnZT86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdlcnJvcicsIHsgdXNlck1lc3NhZ2UgfSk7XG4gIGNvbnN0IGVhcmxpZXN0UmVzZXQgPSBEYXRlLm5vdygpICsgRkVFREJBQ0tfRVJST1JfTVM7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgYXdhaXQgZGVsYXkoMjAwKTtcbiAgICBpZiAoZ2V0QnV0dG9uU3RhdGUoYnV0dG9uKSAhPT0gJ2Vycm9yJykgcmV0dXJuO1xuICAgIGlmIChEYXRlLm5vdygpIDwgZWFybGllc3RSZXNldCkgY29udGludWU7XG4gICAgaWYgKCFidXR0b24ubWF0Y2hlcygnOmhvdmVyJykpIHtcbiAgICAgIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ2lkbGUnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlTWluTG9hZGluZyhzdGFydGVkQXQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBlbGFwc2VkID0gRGF0ZS5ub3coKSAtIHN0YXJ0ZWRBdDtcbiAgaWYgKGVsYXBzZWQgPCBMT0FESU5HX01JTl9NUykgYXdhaXQgZGVsYXkoTE9BRElOR19NSU5fTVMgLSBlbGFwc2VkKTtcbn1cblxuZnVuY3Rpb24gZGVsYXkobXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG59XG5cbmZ1bmN0aW9uIGluaXRDb250ZW50U2NyaXB0KCk6IHZvaWQge1xuICBpZiAoIWlzR29vZ2xlQ2xhc3Nyb29tKCkpIHJldHVybjtcbiAgaW5qZWN0U3R5bGVzKCk7XG4gIHNldHVwT2JzZXJ2ZXJzKCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJ2h0dHBzOi8vY2xhc3Nyb29tLmdvb2dsZS5jb20vKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBtYWluKCkgeyBpbml0Q29udGVudFNjcmlwdCgpOyB9LFxufSk7IiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsImJyb3dzZXIiLCJfYnJvd3NlciIsInByaW50IiwibG9nZ2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsb0JBQW9CQSxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ0NPLFFBQU0sd0JBQXdCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFTOUIsUUFBTSx1QkFBdUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBVTdCLFFBQU0scUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVEzQixRQUFNLHdCQUF3QiwyQkFBMkI7QUFBQSxJQUM5RDtBQUFBLEVBQ0YsQ0FBQztBQUVNLFFBQU0sdUJBQXVCLDJCQUEyQjtBQUFBLElBQzdEO0FBQUEsRUFDRixDQUFDO0FBRU0sUUFBTSxxQkFBcUIsMkJBQTJCO0FBQUEsSUFDM0Q7QUFBQSxFQUNGLENBQUM7QUN0Q0QsUUFBTSxXQUFXO0FBQ2pCLFFBQU0sa0JBQWtCO0FBR3hCLFFBQU0sZ0JBQWdCO0FBQ3RCLFFBQU0saUJBQWlCLEdBQUcs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QUEsR0FBQTtBQUNHLGlCQUFBO0FBSUE7QUFBQSxRQUFBO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFLRixRQUFBLEtBQUEsU0FBQSxLQUFBLEtBQUEsU0FBQSxNQUFBLEdBQUE7QUFDRSxZQUFBLE1BQUEsS0FBQSxTQUFBO0FBQ0EsWUFBQSxZQUFBLEtBQUEsTUFBQSxHQUFBLEdBQUE7QUFDQSxZQUFBLGFBQUEsS0FBQSxNQUFBLEdBQUE7QUFDQSxVQUFBLGNBQUEsWUFBQTtBQUNHLGVBQUE7QUFBQSxNQUFPO0FBQUEsSUFDVjtBQUlGLFVBQUEsY0FBQTtBQUNBLFVBQUEsY0FBQSxLQUFBLE1BQUEsV0FBQTtBQUNBLFFBQUEsYUFBQTtBQUNJLGFBQUEsS0FBQSxNQUFBLEdBQUEsQ0FBQSxZQUFBLENBQUEsRUFBQSxNQUFBLEVBQUEsS0FBQTtBQUFBLElBQWtEO0FBR3RELFdBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxnQkFBQSxXQUFBLEtBQUE7QUFDRSxRQUFBO0FBRUEsVUFBQSxVQUFBLFVBQUEsYUFBQSxjQUFBLEtBQUEsVUFBQSxhQUFBLFlBQUEsS0FBQSxVQUFBLGFBQUEsT0FBQTtBQUtBLFFBQUEsV0FBQSxRQUFBLEtBQUEsRUFBQSxRQUFBLFFBQUEsS0FBQTtBQUVBLFFBQUEsQ0FBQSxNQUFBO0FBQ0UsWUFBQSxRQUFBLFVBQUEsZUFBQSxJQUFBLEtBQUE7QUFDQSxVQUFBLE1BQUE7QUFDRSxjQUFBLFFBQUEsS0FBQSxNQUFBLElBQUEsRUFBQSxJQUFBLENBQUEsTUFBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLE9BQUEsT0FBQTtBQUNBLFlBQUEsTUFBQSxTQUFBLEVBQUEsUUFBQSxNQUFBLENBQUE7QUFBQSxNQUFvQztBQUFBLElBQ3RDO0FBR0YsUUFBQSxDQUFBLE1BQUE7QUFDRSxVQUFBO0FBQ0UsY0FBQSxJQUFBLElBQUEsSUFBQSxHQUFBO0FBQ0EsY0FBQSxXQUFBLG1CQUFBLEVBQUEsU0FBQSxNQUFBLEdBQUEsRUFBQSxJQUFBLEtBQUEsRUFBQTtBQUNBLFlBQUEsWUFBQSxTQUFBLFNBQUEsR0FBQSxFQUFBLFFBQUE7QUFBQSxNQUErQyxRQUFBO0FBQUEsTUFDekM7QUFBQSxJQUFDO0FBSVgsUUFBQSxLQUFBLFFBQUEsb0JBQUEsSUFBQTtBQUdBLFFBQUE7QUFDQSxRQUFBLE1BQUE7QUFDRSxZQUFBLElBQUEsS0FBQSxNQUFBLHdCQUFBO0FBQ0EsVUFBQSxFQUFBLE9BQUEsRUFBQSxDQUFBLEVBQUEsWUFBQTtBQUFBLElBQThCO0FBSWhDLFFBQUEsT0FBQTtBQUNBLFFBQUEsS0FBQTtBQUNFLGNBQUEsS0FBQTtBQUFBO0FBQUEsUUFBYSxLQUFBO0FBRUMsaUJBQUE7QUFBYztBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ3JCLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFhLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBb0IsaUJBQUE7QUFBYztBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ3RILEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFhLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBdUIsaUJBQUE7QUFBZ0I7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUM1RSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBYSxLQUFBO0FBQW1CLGlCQUFBO0FBQWdCO0FBQUE7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUc1RCxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBYSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBYSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBYSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQWtCLGlCQUFBO0FBQWdCO0FBQUEsUUFBQSxLQUFBO0FBQUEsUUFDN0osS0FBQTtBQUFBLFFBQVksS0FBQTtBQUFBLFFBQVksS0FBQTtBQUFBLFFBQVksS0FBQTtBQUFBLFFBQVksS0FBQTtBQUFBLFFBQWEsS0FBQTtBQUFBLFFBQVksS0FBQTtBQUFtQixpQkFBQTtBQUFnQjtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQzVHLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBb0IsaUJBQUE7QUFBZ0I7QUFBQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBR3BGLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBbUIsaUJBQUE7QUFBa0I7QUFBQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBR3ZILEtBQUE7QUFBQSxRQUFhLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFhLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFVLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFhLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFXLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFjLEtBQUE7QUFBQSxRQUFZLEtBQUE7QUFBQSxRQUFhLEtBQUE7QUFBb0IsaUJBQUE7QUFBZTtBQUFBO0FBQUEsUUFBQSxLQUFBO0FBQUEsUUFHcFQsS0FBQTtBQUFBLFFBQVksS0FBQTtBQUFBLFFBQVksS0FBQTtBQUFBLFFBQWEsS0FBQTtBQUFxQixpQkFBQTtBQUFlO0FBQUE7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUd6RSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBWSxLQUFBO0FBQUEsUUFBZSxLQUFBO0FBQUEsUUFBVyxLQUFBO0FBQXNCLGlCQUFBO0FBQWlCO0FBQUEsUUFBQTtBQUV6SyxpQkFBQTtBQUFBLE1BQU87QUFBQSxJQUNsQjtBQUdGLFdBQUEsRUFBQSxNQUFBLEtBQUEsS0FBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLDJCQUFBLFdBQUEsS0FBQTtBQUNFLFFBQUEsQ0FBQSxJQUFBO0FBQ0EsVUFBQSxXQUFBLE9BQUEsaUJBQUEsU0FBQTtBQUNBLFFBQUEsU0FBQSxhQUFBLFNBQUEsV0FBQSxNQUFBLFdBQUE7QUFFQSxVQUFBLFlBQUEsY0FBQSxHQUFBO0FBQ0EsVUFBQSxXQUFBLGdCQUFBLFdBQUEsU0FBQTtBQUNBLFVBQUEsU0FBQSxxQkFBQSxXQUFBLFdBQUEsUUFBQTtBQUVBLFVBQUEsU0FBQSxPQUFBLGNBQUEsb0JBQUE7QUFDQSxRQUFBLE9BQUEsUUFBQSxVQUFBLElBQUEsaUJBQUE7QUFDQSxjQUFBLFlBQUEsTUFBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLGVBQUEsUUFBQTtBQUNFLFFBQUEsT0FBQSxVQUFBLFNBQUEsYUFBQSxFQUFBLFFBQUE7QUFDQSxRQUFBLE9BQUEsVUFBQSxTQUFBLGFBQUEsRUFBQSxRQUFBO0FBQ0EsUUFBQSxPQUFBLFVBQUEsU0FBQSxXQUFBLEVBQUEsUUFBQTtBQUNBLFdBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxlQUFBLFFBQUEsT0FBQSxTQUFBO0FBQ0UsVUFBQSxPQUFBLE9BQUEsY0FBQSxvQkFBQTtBQUNBLFVBQUEsUUFBQSxPQUFBLGNBQUEsWUFBQTtBQUNBLFVBQUEsY0FBQSxPQUFBLGNBQUEsbUJBQUE7QUFDQSxRQUFBLENBQUEsUUFBQSxDQUFBLFNBQUEsQ0FBQSxZQUFBO0FBRUEsV0FBQSxVQUFBLE9BQUEsZUFBQSxlQUFBLFdBQUE7QUFDQSxTQUFBLFVBQUEsT0FBQSxhQUFBO0FBQ0EsU0FBQSxjQUFBO0FBQ0EsV0FBQSxXQUFBO0FBQ0EsV0FBQSxNQUFBLGtCQUFBO0FBQ0EsVUFBQSxjQUFBO0FBQ0EsZ0JBQUEsY0FBQTtBQUVBLFNBQUEsTUFBQSxrQkFBQSxRQUFBLHFCQUFBO0FBQ0EsU0FBQSxNQUFBLGlCQUFBO0FBRUEsWUFBQSxPQUFBO0FBQUEsTUFBZSxLQUFBO0FBQ0E7QUFBQSxNQUFBLEtBQUE7QUFFWCxlQUFBLFVBQUEsSUFBQSxhQUFBO0FBQ0EsZUFBQSxXQUFBO0FBQ0EsY0FBQSxjQUFBO0FBQ0EsYUFBQSxVQUFBLElBQUEsYUFBQTtBQUNBLGFBQUEsTUFBQSxrQkFBQTtBQUNBO0FBQUEsTUFBQSxLQUFBO0FBRUEsZUFBQSxVQUFBLElBQUEsYUFBQTtBQUNBLGVBQUEsTUFBQSxrQkFBQTtBQUNBLGNBQUEsY0FBQTtBQUNBLGFBQUEsTUFBQSxrQkFBQSxRQUFBLG9CQUFBO0FBQ0EsYUFBQSxNQUFBLGlCQUFBO0FBQ0E7QUFBQSxNQUFBLEtBQUE7QUFFQSxlQUFBLFVBQUEsSUFBQSxXQUFBO0FBQ0EsZUFBQSxNQUFBLGtCQUFBO0FBQ0EsY0FBQSxjQUFBO0FBQ0EsYUFBQSxNQUFBLGtCQUFBLFFBQUEsa0JBQUE7QUFDQSxhQUFBLE1BQUEsaUJBQUE7QUFDQSxvQkFBQSxjQUFBLFNBQUEsZUFBQTtBQUNBO0FBQUEsSUFBQTtBQUFBLEVBRU47QUFNQSxXQUFBLHFCQUFBLFlBQUEsS0FBQSxVQUFBO0FBQ0UsVUFBQSxTQUFBLFNBQUEsY0FBQSxRQUFBO0FBQ0EsV0FBQSxPQUFBO0FBQ0EsV0FBQSxZQUFBO0FBQ0EsV0FBQSxhQUFBLGVBQUEsTUFBQTtBQUNBLFdBQUEsYUFBQSxjQUFBLFlBQUEsU0FBQSxRQUFBLFlBQUEsRUFBQTtBQUNBLFdBQUEsYUFBQSxTQUFBLGdCQUFBO0FBRUEsVUFBQSxjQUFBLFNBQUEsY0FBQSxNQUFBO0FBQ0EsZ0JBQUEsWUFBQTtBQUNBLFVBQUEsV0FBQSxTQUFBLGNBQUEsTUFBQTtBQUNBLGFBQUEsWUFBQTtBQUNBLGdCQUFBLFlBQUEsUUFBQTtB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QUFDLEtBQUssbUJBQW1CLElBQUksTUFBTSxNQUFNLFNBQVM7QUFDekUsYUFBTyx3QkFBd0IsdUJBQXVCO0FBQUEsSUFDeEQ7QUFBQSxJQUNBLHNCQUFzQixTQUFTO0FBQzdCLFVBQUksVUFBVTtBQUNkLFlBQU0sS0FBSyxDQUFDLFVBQVU7QUFDcEIsWUFBSSxLQUFLLHlCQUF5QixLQUFLLEdBQUc7QUFDeEMsZUFBSyxtQkFBbUIsSUFBSSxNQUFNLEtBQUssU0FBUztBQUNoRCxnQkFBTSxXQUFXO0FBQ2pCLG9CQUFVO0FBQ1YsY0FBSSxZQUFZLFNBQVMsaUJBQWtCO0FBQzNDLGVBQUssa0JBQWlCO0FBQUEsUUFDeEI7QUFBQSxNQUNGO0FBQ0EsdUJBQWlCLFdBQVcsRUFBRTtBQUM5QixXQUFLLGNBQWMsTUFBTSxvQkFBb0IsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUM3RDtBQUFBLEVBQ0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCw0LDUsNiw3LDgsOV19
content;